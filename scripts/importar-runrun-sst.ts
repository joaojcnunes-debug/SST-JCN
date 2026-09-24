/**
 * scripts/importar-runrun-sst.ts — GESTAO-KANBAN-01 F4-SST
 *
 * Importa o board SST do Runrun (594810) para os 6 quadros de unidade do Gestão (+ "SST — Entrada"
 * para o que não tem unidade). Pai → gestao_tarefas; filha → gestao_subtarefas. Gera um .sql
 * idempotente (aplicado pelo operador com psql, ensaio com rollback antes) e um relatório.
 *
 * ─── Como rodar ─────────────────────────────────────────────────────────────────
 *   node --import ./scripts/testes/carregador.mjs scripts/importar-runrun-sst.ts \
 *        --tarefas <cache do /tasks (json)> [--users <cache do /users (json)>] \
 *        [--descricoes <cache json>] [--buscar-descricoes] [--emails <json {id_runrun: e-mail}>] \
 *        [--sql <saida.sql>] [--dry-run]
 *
 *   • --tarefas: JSON bruto da listagem (abertas+fechadas), gerado por sst-perfil.mjs / cache.
 *   • --users: cache de /users; sem ele e com RUNRUN_APP_KEY/USER_TOKEN no ambiente, busca e grava.
 *   • --buscar-descricoes: GET /tasks/:id de cada PAI (backoff no 429), grava/atualiza o cache
 *     --descricoes. Sem isso as tarefas nascem sem descrição (o campo fica null; re-rodar depois
 *     com descrições atualiza — o upsert só preenche descricao quando vier valor).
 *
 * ─── O SQL (uma transação) ───────────────────────────────────────────────────────
 *   1. desliga os gatilhos de AUTOMAÇÃO (tarefa e subtarefa) e silencia o do Google (GUC) — o
 *      import não pode disparar as 258 automações das unidades; histórico/auditoria/espelhos seguem;
 *   2. garante os status necessários no "SST — Entrada" (nas unidades eles JÁ existem — aborta se não);
 *   3. upsert de tarefas por runrun_id (id_tarefa determinístico RRN-<id>), subtarefas por id (SRR-<id>),
 *      vínculos por (id_tarefa, e-mail, tipo) casando e-mail em `usuarios` (não-casados → gestao_import_log);
 *   4. religa os gatilhos, asserções de contagem, resumo por quadro/etapa; commit.
 *
 * Segurança: credenciais só de process.env (só para /users e detalhes); nada de token em log.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  mapearBoardSST, type RRTaskSST, type RRUser, type ResultadoMapa,
} from "@/lib/gestao/import/runrun-sst-mapa";
import { QUADRO_SST_ENTRADA, UNIDADES } from "@/lib/gestao/import/runrun-forms-mapa";

const RUNRUN_BASE = "https://runrun.it/api/v1.0";
const LOTE = 200;

interface Opcoes { tarefas: string; users: string | null; descricoes: string | null; buscarDescricoes: boolean; sql: string | null; dryRun: boolean; emails: string | null }
function lerFlags(argv: string[]): Opcoes {
  const o: Opcoes = { tarefas: "", users: null, descricoes: null, buscarDescricoes: false, sql: null, dryRun: false, emails: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => (a.includes("=") ? a.slice(a.indexOf("=") + 1) : argv[++i] ?? "");
    if (a === "--dry-run") o.dryRun = true;
    else if (a === "--buscar-descricoes") o.buscarDescricoes = true;
    else if (a.startsWith("--tarefas")) o.tarefas = val();
    else if (a.startsWith("--users")) o.users = val();
    else if (a.startsWith("--descricoes")) o.descricoes = val();
    else if (a.startsWith("--sql")) o.sql = val();
    else if (a.startsWith("--emails")) o.emails = val();
  }
  if (!o.tarefas) throw new Error("Falta --tarefas <cache json da listagem>.");
  if (!o.dryRun && !o.sql) throw new Error("Sem --dry-run é obrigatório --sql <saida.sql>.");
  return o;
}

// ── Runrun (só leitura; backoff no 429) ──────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function cabecalhos(): Record<string, string> {
  const k = process.env.RUNRUN_APP_KEY ?? "", t = process.env.RUNRUN_USER_TOKEN ?? "";
  if (!k || !t) throw new Error("RUNRUN_APP_KEY/RUNRUN_USER_TOKEN ausentes no ambiente (necessários só para --users sem cache / --buscar-descricoes).");
  return { "App-Key": k, "User-Token": t, "Content-Type": "application/json" };
}
async function getRunrun<T>(caminho: string, opts: { tolerar404?: boolean } = {}): Promise<T | null> {
  for (let tent = 0; tent < 8; tent++) {
    const r = await fetch(RUNRUN_BASE + caminho, { headers: cabecalhos() });
    if (r.status === 429) { const ra = Number(r.headers.get("retry-after")) || 30; process.stderr.write(`429 em ${caminho} - aguardando ${ra}s\n`); await sleep(ra * 1000); continue; }
    if (r.status === 404 && opts.tolerar404) return null; // tarefa apagada no Runrun depois da listagem
    if (!r.ok) throw new Error(`GET ${caminho} -> ${r.status}`);
    return (await r.json()) as T;
  }
  throw new Error(`GET ${caminho} -> 429 persistente`);
}
async function listarUsers(): Promise<RRUser[]> {
  const out: RRUser[] = [];
  for (let pg = 1; ; pg++) {
    const lote = (await getRunrun<RRUser[]>(`/users?limit=100&page=${pg}`)) ?? [];
    if (!Array.isArray(lote) || !lote.length) break;
    out.push(...lote);
    if (lote.length < 100) break;
    await sleep(300);
  }
  return out;
}

// ── SQL helpers ───────────────────────────────────────────────────────────────
const q = (v: string | null | undefined) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const qj = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;
const qarr = (v: string[]) => `array[${v.map((x) => q(x)).join(",")}]::text[]`;
const qn = (v: number | null) => (v === null || v === undefined ? "null" : String(v));
function lotes<T>(arr: T[], n: number): T[][] { const out: T[][] = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; }

function gerarSql(r: ResultadoMapa, origemArquivo: string): string {
  const L: string[] = [];
  const quadros = [...new Set(r.tarefas.map((t) => t.id_quadro))];
  const unidades = UNIDADES.map((u) => u.id_quadro);
  L.push(`-- Gerado por scripts/importar-runrun-sst.ts em ${new Date().toISOString()} a partir de ${origemArquivo.replace(/\\/g, "/")}.`);
  L.push(`-- ${r.tarefas.length} tarefas, ${r.subtarefas.length} subtarefas, ${r.vinculos.length} vínculos, ${r.log.length} linhas de log. Idempotente (upsert por runrun_id / id).`);
  L.push(`\\set ON_ERROR_STOP on`);
  L.push(`begin;`);
  L.push(`-- 1) sem automação e sem Google durante o import (histórico/auditoria/espelhos seguem ligados)`);
  L.push(`select set_config('gestao.in_google_sync', 'on', true);`);
  L.push(`alter table public.gestao_tarefas disable trigger trg_gestao_automacao_ins;`);
  L.push(`alter table public.gestao_tarefas disable trigger trg_gestao_automacao_upd;`);
  L.push(`alter table public.gestao_subtarefas disable trigger gestao_subtarefa_autom_trg;`);
  L.push(`-- 2) status: unidades JÁ têm as 16 colunas (aborta se faltar); SST — Entrada ganha o que precisar`);
  L.push(`do $$ declare n int; begin`);
  L.push(`  select count(*) into n from (values ${r.statusNecessarios.filter((s) => unidades.includes(s.id_quadro)).map((s) => `(${q(s.id_quadro)},${q(s.slug)})`).join(",") || "('x','x')"}) v(qd,sl) where not exists (select 1 from public.gestao_status s where s.id_quadro = v.qd and s.slug = v.sl) and v.qd <> 'x';`);
  L.push(`  if n <> 0 then raise exception '% status esperados nas unidades não existem — de-para desatualizado', n; end if;`);
  L.push(`end $$;`);
  for (const s of r.statusNecessarios.filter((s) => s.id_quadro === QUADRO_SST_ENTRADA)) {
    L.push(`insert into public.gestao_status (id, id_quadro, slug, nome, cor, ordem, tipo) select gen_random_uuid(), ${q(s.id_quadro)}, ${q(s.slug)}, ${q(s.nome)}, '#94a3b8', coalesce((select max(ordem) from public.gestao_status where id_quadro = ${q(s.id_quadro)}), 0) + 1, ${s.slug === "CONCLUIDA" || s.slug === "INATIVAS_INADIMPLENTES" ? "'concluido'" : "'ativo'"} where not exists (select 1 from public.gestao_status where id_quadro = ${q(s.id_quadro)} and slug = ${q(s.slug)});`);
  }
  L.push(`-- 3a) tarefas (upsert por runrun_id; id_tarefa determinístico RRN-<id>)`);
  for (const lote of lotes(r.tarefas, LOTE)) {
    L.push(`insert into public.gestao_tarefas (id_tarefa, id_quadro, runrun_id, titulo, descricao, responsavel, status, prioridade, prazo, data_inicio, ordem, etiquetas, campos, pontos, created_by, created_at, updated_at, origem) values`);
    L.push(lote.map((t) => `(${q(t.id_tarefa)}, ${q(t.id_quadro)}, ${t.runrun_id}, ${q(t.titulo)}, ${q(t.descricao)}, ${q(t.responsavel)}, ${q(t.status)}, ${q(t.prioridade)}, ${q(t.prazo)}, ${q(t.data_inicio)}, ${t.ordem}, ${qarr(t.etiquetas)}, ${qj(t.campos)}, ${qn(t.pontos)}, 'importador', ${q(t.created_at)}, ${q(t.updated_at)}, ${qj(t.origem)})`).join(",\n"));
    L.push(`on conflict (runrun_id) do update set id_quadro = excluded.id_quadro, titulo = excluded.titulo, descricao = coalesce(excluded.descricao, public.gestao_tarefas.descricao), responsavel = coalesce(public.gestao_tarefas.responsavel, excluded.responsavel), status = excluded.status, prioridade = excluded.prioridade, prazo = excluded.prazo, data_inicio = excluded.data_inicio, ordem = excluded.ordem, etiquetas = excluded.etiquetas, campos = excluded.campos, pontos = excluded.pontos, origem = excluded.origem, updated_at = now();`);
  }
  L.push(`-- 3b) subtarefas (upsert por id SRR-<id>; o trigger-espelho v199 mantém o jsonb da tarefa)`);
  for (const lote of lotes(r.subtarefas, LOTE)) {
    L.push(`insert into public.gestao_subtarefas (id, id_tarefa, texto, feito, ordem, etapa, responsavel_email, created_at) values`);
    L.push(lote.map((s) => `(${q(s.id)}, ${q(s.id_tarefa)}, ${q(s.texto)}, ${s.feito}, ${s.ordem}, ${q(s.etapa)}, ${q(s.responsavel_email)}, ${q(s.created_at)})`).join(",\n"));
    L.push(`on conflict (id) do update set texto = excluded.texto, feito = excluded.feito, ordem = excluded.ordem, etapa = excluded.etapa, responsavel_email = excluded.responsavel_email;`);
  }
  L.push(`-- 3c) vínculos: só e-mails com conta no painel (usuarios); o trigger-espelho v187 preenche responsavel`);
  for (const lote of lotes(r.vinculos, LOTE)) {
    L.push(`insert into public.gestao_tarefa_vinculados (id_tarefa, usuario_email, tipo, origem)`);
    L.push(`select v.id_tarefa, u.email, v.tipo, 'import' from (values ${lote.map((v) => `(${q(v.id_tarefa)},${q(v.email)},${q(v.tipo)})`).join(",")}) v(id_tarefa, email, tipo)`);
    L.push(`join public.usuarios u on lower(u.email) = v.email on conflict (id_tarefa, usuario_email, tipo) do nothing;`);
  }
  L.push(`-- 3d) log: não-casados por e-mail (sem conta no painel), sem unidade, etc.`);
  L.push(`delete from public.gestao_import_log where board_runrun = 'SST';`);
  for (const lote of lotes(r.vinculos, LOTE)) {
    L.push(`insert into public.gestao_import_log (runrun_id, id_tarefa, board_runrun, resultado, detalhe)`);
    L.push(`select null, v.id_tarefa, 'SST', 'nao_casado', v.tipo || ': ' || v.email || ' sem conta no painel' from (values ${lote.map((v) => `(${q(v.id_tarefa)},${q(v.email)},${q(v.tipo)})`).join(",")}) v(id_tarefa, email, tipo)`);
    L.push(`where not exists (select 1 from public.usuarios u where lower(u.email) = v.email);`);
  }
  for (const lote of lotes(r.log.filter((l) => l.resultado !== "ok"), LOTE)) {
    L.push(`insert into public.gestao_import_log (runrun_id, id_tarefa, board_runrun, resultado, detalhe) values ${lote.map((l) => `(${l.runrun_id}, ${q(l.id_tarefa)}, 'SST', ${q(l.resultado)}, ${q(l.detalhe.slice(0, 300))})`).join(",")};`);
  }
  L.push(`-- 4) religa os gatilhos e prova`);
  L.push(`alter table public.gestao_tarefas enable trigger trg_gestao_automacao_ins;`);
  L.push(`alter table public.gestao_tarefas enable trigger trg_gestao_automacao_upd;`);
  L.push(`alter table public.gestao_subtarefas enable trigger gestao_subtarefa_autom_trg;`);
  L.push(`do $$ declare n int; begin`);
  L.push(`  select count(*) into n from public.gestao_tarefas where (origem->>'board_id') = '594810';`);
  L.push(`  if n <> ${r.tarefas.length} then raise exception 'tarefas do SST no banco = % (esperado ${r.tarefas.length})', n; end if;`);
  L.push(`  select count(*) into n from public.gestao_subtarefas s join public.gestao_tarefas t using (id_tarefa) where (t.origem->>'board_id') = '594810';`);
  L.push(`  if n <> ${r.subtarefas.length} then raise exception 'subtarefas do SST no banco = % (esperado ${r.subtarefas.length})', n; end if;`);
  L.push(`  select count(*) into n from public.gestao_tarefas t where (t.origem->>'board_id') = '594810' and not exists (select 1 from public.gestao_status s where s.id_quadro = t.id_quadro and s.slug = t.status);`);
  L.push(`  if n <> 0 then raise exception '% tarefas com status sem coluna no quadro', n; end if;`);
  L.push(`  select count(*) into n from public.gestao_tarefas t where (t.origem->>'board_id') = '594810' and t.id_quadro not in (${[...quadros].map((x) => q(x)).join(",")});`);
  L.push(`  if n <> 0 then raise exception '% tarefas fora dos quadros esperados', n; end if;`);
  L.push(`end $$;`);
  L.push(`select q.nome as quadro, t.status, count(*) from public.gestao_tarefas t join public.gestao_quadros q using (id_quadro) where (t.origem->>'board_id') = '594810' group by 1, 2 order by 1, 3 desc;`);
  L.push(`select resultado, count(*) from public.gestao_import_log where board_runrun = 'SST' group by 1 order by 2 desc;`);
  L.push(`select count(*) as vinculos_gravados from public.gestao_tarefa_vinculados v join public.gestao_tarefas t using (id_tarefa) where (t.origem->>'board_id') = '594810';`);
  L.push(`commit;`);
  return L.join("\n") + "\n";
}

async function principal(): Promise<void> {
  const opc = lerFlags(process.argv.slice(2));
  const tasks = JSON.parse(readFileSync(opc.tarefas, "utf8")) as RRTaskSST[];
  if (!Array.isArray(tasks) || !tasks.length) throw new Error("--tarefas vazio.");

  let usersArr: RRUser[] = [];
  if (opc.users && existsSync(opc.users)) usersArr = JSON.parse(readFileSync(opc.users, "utf8")) as RRUser[];
  else {
    usersArr = await listarUsers();
    if (opc.users) { writeFileSync(opc.users, JSON.stringify(usersArr), "utf8"); console.log(`users: ${usersArr.length} gravados em ${opc.users}`); }
  }
  const users = new Map(usersArr.map((u) => [u.id, u]));
  // Mapa manual {id_runrun: e-mail} para usuários que o /users devolve sem e-mail (desativados).
  if (opc.emails && existsSync(opc.emails)) {
    for (const [id, email] of Object.entries(JSON.parse(readFileSync(opc.emails, "utf8")) as Record<string, string>)) {
      users.set(id, { ...(users.get(id) ?? { id }), email });
    }
    console.log(`e-mails manuais aplicados: ${Object.keys(JSON.parse(readFileSync(opc.emails, "utf8"))).length}`);
  }

  const descricoes = new Map<number, string | null>();
  if (opc.descricoes && existsSync(opc.descricoes)) {
    for (const [k, v] of Object.entries(JSON.parse(readFileSync(opc.descricoes, "utf8")) as Record<string, string | null>)) descricoes.set(Number(k), v);
  }
  if (opc.buscarDescricoes) {
    const pais = tasks.filter((t) => !t.is_subtask && !descricoes.has(t.id));
    console.log(`buscando descrição de ${pais.length} pais (cache tinha ${descricoes.size})…`);
    let n = 0;
    // A descricao NAO vem no /tasks/:id (so `description_preview`) - vive em
    // /tasks/:id/description -> { id, description: <html> }. 404 = tarefa apagada apos a listagem.
    for (const p of pais) {
      const d = await getRunrun<{ id: number; description?: string | null }>(`/tasks/${p.id}/description`, { tolerar404: true });
      descricoes.set(p.id, d?.description ?? null);
      n++;
      if (n % 50 === 0 && opc.descricoes) { writeFileSync(opc.descricoes, JSON.stringify(Object.fromEntries(descricoes)), "utf8"); process.stderr.write(`${n}/${pais.length} `); }
      await sleep(500);
    }
    if (opc.descricoes) writeFileSync(opc.descricoes, JSON.stringify(Object.fromEntries(descricoes)), "utf8");
    console.log(`descrições: ${descricoes.size} no cache`);
  }

  const r = mapearBoardSST(tasks, users, descricoes);
  const porQuadro = new Map<string, { total: number; abertas: number }>();
  for (const t of r.tarefas) { const c = porQuadro.get(t.id_quadro) ?? { total: 0, abertas: 0 }; c.total++; if (!(t.origem.is_closed as boolean)) c.abertas++; porQuadro.set(t.id_quadro, c); }
  const nome = new Map([...UNIDADES.map((u) => [u.id_quadro, u.label] as [string, string]), [QUADRO_SST_ENTRADA, "SST — Entrada"]]);
  console.log(`tarefas (pais): ${r.tarefas.length} | subtarefas: ${r.subtarefas.length} | vínculos: ${r.vinculos.length} | users Runrun: ${users.size}`);
  console.log(`stats:`, r.stats);
  for (const [qd, c] of [...porQuadro.entries()].sort((a, b) => b[1].total - a[1].total)) console.log(`  ${qd} ${nome.get(qd) ?? ""}: ${c.total} (abertas ${c.abertas})`);
  const porStatus = new Map<string, number>(); for (const t of r.tarefas) porStatus.set(t.status, (porStatus.get(t.status) ?? 0) + 1);
  console.log(`por etapa:`, [...porStatus.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(", "));
  const naoOk = r.log.filter((l) => l.resultado !== "ok");
  const porRes = new Map<string, number>(); for (const l of naoOk) porRes.set(l.resultado, (porRes.get(l.resultado) ?? 0) + 1);
  console.log(`log (não-ok): ${[...porRes.entries()].map(([k, v]) => `${k}=${v}`).join(", ") || "nenhum"}`);
  const semEmail = new Map<string, number>(); for (const l of naoOk.filter((x) => x.resultado === "nao_casado")) { const m = /: (\S+) sem e-mail/.exec(l.detalhe); if (m) semEmail.set(m[1], (semEmail.get(m[1]) ?? 0) + 1); }
  if (semEmail.size) console.log(`usuários do Runrun sem e-mail (top):`, [...semEmail.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${k}×${v}`).join(", "));
  const emails = new Set(r.vinculos.map((v) => v.email));
  console.log(`e-mails distintos a casar em usuarios: ${emails.size} (o SQL grava só os que existem; os demais vão ao gestao_import_log)`);
  if (r.stats.etapa_desconhecida) throw new Error(`${r.stats.etapa_desconhecida} tarefas com etapa desconhecida — atualize ETAPAS_SST antes de gerar SQL`);

  if (opc.dryRun || !opc.sql) return;
  const sql = gerarSql(r, opc.tarefas);
  writeFileSync(opc.sql, sql, "utf8");
  console.log(`SQL gravado em ${opc.sql} (${(sql.length / 1024 / 1024).toFixed(1)} MB).`);
}

principal().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
