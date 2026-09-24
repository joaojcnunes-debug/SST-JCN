/**
 * scripts/importar-runrun-forms.ts — GESTAO-KANBAN-03 F3
 *
 * Importa os FORMULÁRIOS do Runrun.it para gestao_formularios, a partir do JSON capturado
 * (raw/runrun/forms-AAAA-MM-DD.json no vault — forms + perguntas + opções + ramificações).
 * Não fala com o Runrun nem com o banco: gera um .sql idempotente que o operador aplica com
 * psql na .107 (ensaio com rollback e depois real, como a fusão do piloto), e um relatório.
 *
 * ─── Como rodar ─────────────────────────────────────────────────────────────────
 *   node --import ./scripts/testes/carregador.mjs scripts/importar-runrun-forms.ts \
 *        --json <caminho do JSON> [--sql <saida.sql>] [--form <id_runrun>] [--dry-run]
 *
 *   --dry-run  só imprime o relatório (de-para, avisos, o que vai para a descrição).
 *   --sql      grava o SQL (uma transação, asserções, ON CONFLICT por runrun_form_id).
 *   --form     restringe a um form (piloto).
 *
 * ─── O que o SQL faz (nesta ordem, tudo idempotente) ────────────────────────────
 *   1. quadros novos (espaço Geral / pasta JCN Consultoria) + status;
 *   2. campos personalizados que faltam nos quadros-alvo (Produtos (T.I), Orçamento Químico…);
 *      Produtos/Tipo de Cliente NÃO são duplicados: os forms apontam para os ids globais do Comercial;
 *   3. formulários: insert … on conflict (runrun_form_id) do update (token preservado; token novo =
 *      24 hex por md5(random) — sem depender de pgcrypto);
 *   4. automações de roteamento do "SST — Entrada" (18 = 6 unidades × 3 etapas), where not exists;
 *   5. asserções de contagem antes do commit.
 *
 * Segurança: nenhuma credencial; nenhum dado de respondente (só a DEFINIÇÃO dos forms).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { temCiclo } from "@/lib/gestao/formularios";
import {
  MAPA_BOARDS, UNIDADES, ESPACO_GERAL, PASTA_CHABRA, CAMPO_PRODUTOS_ID, CAMPO_TIPO_CLIENTE_ID, QUADRO_SST_ENTRADA,
  mapearForm, automacoesRoteamentoSST,
  type RRForm, type FormMapeado, type CtxMapa,
} from "@/lib/gestao/import/runrun-forms-mapa";

// ── Flags ─────────────────────────────────────────────────────────────────────
interface Opcoes { json: string; sql: string | null; form: number | null; dryRun: boolean }
function lerFlags(argv: string[]): Opcoes {
  let json = "", sql: string | null = null, form: number | null = null, dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") dryRun = true;
    else if (a === "--json") json = argv[++i] ?? "";
    else if (a.startsWith("--json=")) json = a.slice(7);
    else if (a === "--sql") sql = argv[++i] ?? null;
    else if (a.startsWith("--sql=")) sql = a.slice(6);
    else if (a === "--form") form = Number(argv[++i]);
    else if (a.startsWith("--form=")) form = Number(a.slice(7));
  }
  if (!json) throw new Error("Falta --json <arquivo capturado do Runrun>.");
  if (form !== null && (!Number.isInteger(form) || form <= 0)) throw new Error("--form deve ser inteiro positivo.");
  if (!dryRun && !sql) throw new Error("Sem --dry-run é obrigatório --sql <saida.sql>.");
  return { json, sql, form, dryRun };
}

// ── SQL helpers ───────────────────────────────────────────────────────────────
const q = (v: string | null | undefined) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const qj = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;
const qarr = (v: string[]) => `array[${v.map((x) => q(x)).join(",")}]::text[]`;

// Campos por quadro: id determinístico p/ os NOVOS (uuid v5-like a partir de md5 no SQL) — assim
// o mesmo SQL rodado 2× não duplica (where not exists por (id_quadro, nome)) e o form aponta
// para o mesmo id. Produtos/Tipo de Cliente = ids globais do Comercial (não criados).
interface CampoNovo { id: string; id_quadro: string; nome: string; tipo: "multi" | "selecao"; opcoes: string[] }
function idCampoDeterministico(idQuadro: string, nome: string): string {
  // uuid "estável" derivado de md5 — calculado em JS p/ o form já nascer com o id; o SQL usa o mesmo.
  const h = md5Hex(`gestao_campo|${idQuadro}|${nome}`);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
function md5Hex(s: string): string { return createHash("md5").update(s).digest("hex"); }

// ── Principal ─────────────────────────────────────────────────────────────────
function principal(): void {
  const opc = lerFlags(process.argv.slice(2));
  const bruto = JSON.parse(readFileSync(opc.json, "utf8")) as { capturado_em: string; forms: RRForm[] };
  const forms = bruto.forms.filter((f) => opc.form === null || f.id === opc.form);
  if (forms.length === 0) throw new Error("Nenhum form no JSON (ou --form não existe).");

  const avisos: string[] = [];
  const camposNovos = new Map<string, CampoNovo>();
  const ctx: CtxMapa = {
    campoDestino: (fieldKey, quadro, nome, tipo, opcoes) => {
      if (fieldKey === "custom_86") return `campo:${CAMPO_PRODUTOS_ID}`;
      if (fieldKey === "custom_100") return `campo:${CAMPO_TIPO_CLIENTE_ID}`;
      const id = idCampoDeterministico(quadro, nome);
      const chave = `${quadro}|${nome}`;
      if (!camposNovos.has(chave)) camposNovos.set(chave, { id, id_quadro: quadro, nome, tipo, opcoes });
      return `campo:${id}`;
    },
  };

  const mapeados: FormMapeado[] = [];
  for (const f of forms) {
    const m = mapearForm(f, ctx, avisos);
    if (!m) continue;
    // Ciclo de condição (A↔B) deixaria o form público inutilizável — nunca gera SQL com isso.
    if (temCiclo(m.perguntas)) throw new Error(`form ${f.id} "${f.title}": ciclo nas condições das perguntas — corrija o de-para antes de gerar SQL`);
    mapeados.push(m);
  }

  // Relatório
  console.log(`JSON capturado em ${bruto.capturado_em}; forms no arquivo: ${bruto.forms.length}; considerados: ${forms.length}; mapeados: ${mapeados.length}`);
  const porQuadro = new Map<string, number>();
  for (const m of mapeados) porQuadro.set(m.id_quadro, (porQuadro.get(m.id_quadro) ?? 0) + 1);
  const nomeQuadro = new Map(Object.values(MAPA_BOARDS).filter((b) => !!b).map((b) => [b!.id_quadro, b!.nome]));
  for (const [k, v] of porQuadro) console.log(`  ${k}  ${nomeQuadro.get(k) ?? ""}: ${v} form(s)`);
  for (const m of mapeados) {
    const nDesc = m.perguntas.filter((p) => (p.destino ?? "descricao") === "descricao").length;
    const nCampo = m.perguntas.filter((p) => (p.destino ?? "").startsWith("campo:")).length;
    const nTag = m.perguntas.filter((p) => p.destino === "etiquetas").length;
    const nCond = m.perguntas.filter((p) => p.condicao).length;
    const nAnexo = m.perguntas.filter((p) => p.pendente_anexo).length;
    console.log(`  [${m.runrun_form_id}] ${m.ativo ? "ativo " : "INATIVO"} → ${m.id_quadro} status=${m.status_inicial} prio=${m.prioridade_padrao} título=${m.titulo_composicao ? m.titulo_composicao.join("+") : "(digitado)"} perguntas=${m.perguntas.length} (descrição ${nDesc}, campo ${nCampo}, etiqueta ${nTag}, condicionais ${nCond}, anexo ${nAnexo}) :: ${m.titulo}`);
  }
  if (camposNovos.size) {
    console.log("Campos personalizados a criar:");
    for (const c of camposNovos.values()) console.log(`  ${c.id_quadro} · ${c.nome} (${c.tipo}, ${c.opcoes.length} opções) → ${c.id}`);
  }
  if (avisos.length) { console.log(`Avisos (${avisos.length}):`); for (const a of avisos) console.log("  - " + a); }

  if (opc.dryRun || !opc.sql) return;

  // ── SQL ──
  const L: string[] = [];
  L.push(`-- Gerado por scripts/importar-runrun-forms.ts em ${new Date().toISOString()} a partir de ${opc.json.replace(/\\/g, "/")} (capturado ${bruto.capturado_em}).`);
  L.push(`-- Idempotente: quadros/status/campos por where-not-exists; forms por ON CONFLICT (runrun_form_id); automações por nome.`);
  L.push(`\\set ON_ERROR_STOP on`);
  L.push(`begin;`);
  L.push(`select set_config('gestao.in_google_sync', 'on', true);`);

  // 1) quadros novos + status
  const quadrosUsados = new Set(mapeados.map((m) => m.id_quadro));
  const boards = Object.entries(MAPA_BOARDS).map(([, v]) => v).filter((v): v is NonNullable<typeof v> => !!v);
  for (const b of boards) {
    if (!quadrosUsados.has(b.id_quadro)) continue;
    if (b.novo) {
      L.push(`insert into public.gestao_quadros (id_quadro, nome, descricao, id_espaco, id_pasta, ordem, restrito, created_by)`);
      L.push(`  select ${q(b.id_quadro)}, ${q(b.nome)}, 'Criado pelo import de formulários do Runrun (GESTAO-KANBAN-03)', ${q(ESPACO_GERAL)}, ${q(PASTA_CHABRA)}, 90, false, 'importador'`);
      L.push(`  where not exists (select 1 from public.gestao_quadros where id_quadro = ${q(b.id_quadro)});`);
    }
    for (const s of b.status ?? []) {
      L.push(`insert into public.gestao_status (id, id_quadro, slug, nome, cor, ordem, tipo) values (gen_random_uuid(), ${q(b.id_quadro)}, ${q(s.slug)}, ${q(s.nome)}, '#94a3b8', ${s.ordem}, ${q(s.tipo)}) on conflict (id_quadro, slug) do nothing;`);
    }
    // status_inicial de forms em quadro EXISTENTE precisa existir (ex.: "Orçamento - Aguardando Aprovação" no Comercial)
    for (const m of mapeados.filter((x) => x.id_quadro === b.id_quadro)) {
      const nomeEtapa = String(m.origem.stage_name ?? m.status_inicial);
      L.push(`insert into public.gestao_status (id, id_quadro, slug, nome, cor, ordem, tipo) select gen_random_uuid(), ${q(b.id_quadro)}, ${q(m.status_inicial)}, ${q(nomeEtapa)}, '#94a3b8', coalesce((select max(ordem) from public.gestao_status where id_quadro = ${q(b.id_quadro)}), 0) + 1, 'ativo' where not exists (select 1 from public.gestao_status where id_quadro = ${q(b.id_quadro)} and slug = ${q(m.status_inicial)});`);
    }
  }

  // 2) campos novos
  for (const c of camposNovos.values()) {
    L.push(`insert into public.gestao_campos (id, id_quadro, nome, tipo, opcoes, ordem, visivel_cliente) select ${q(c.id)}, ${q(c.id_quadro)}, ${q(c.nome)}, ${q(c.tipo)}, ${qarr(c.opcoes)}, coalesce((select max(ordem) from public.gestao_campos where id_quadro = ${q(c.id_quadro)}), -1) + 1, false where not exists (select 1 from public.gestao_campos where id = ${q(c.id)});`);
  }

  // 3) formulários
  for (const m of mapeados) {
    L.push(`insert into public.gestao_formularios (id, id_quadro, titulo, descricao, token, ativo, mostra_descricao, mostra_prazo, mostra_prioridade, prioridade_padrao, status_inicial, responsavel_padrao, responsavel_email, etiquetas_padrao, perguntas, titulo_composicao, runrun_form_id, origem, created_by)`);
    L.push(`  values (gen_random_uuid(), ${q(m.id_quadro)}, ${q(m.titulo)}, ${q(m.descricao)}, substr(md5(random()::text || clock_timestamp()::text || ${m.runrun_form_id}), 1, 24), ${m.ativo}, ${m.mostra_descricao}, ${m.mostra_prazo}, ${m.mostra_prioridade}, ${q(m.prioridade_padrao)}, ${q(m.status_inicial)}, null, null, ${qarr(m.etiquetas_padrao)}, ${qj(m.perguntas)}, ${m.titulo_composicao ? qj(m.titulo_composicao) : "null"}, ${m.runrun_form_id}, ${qj(m.origem)}, 'importador')`);
    L.push(`  on conflict (runrun_form_id) where runrun_form_id is not null do update set id_quadro = excluded.id_quadro, titulo = excluded.titulo, descricao = excluded.descricao, ativo = excluded.ativo, prioridade_padrao = excluded.prioridade_padrao, status_inicial = excluded.status_inicial, etiquetas_padrao = excluded.etiquetas_padrao, perguntas = excluded.perguntas, titulo_composicao = excluded.titulo_composicao, origem = excluded.origem;`);
  }

  // 4) roteamento SST — Entrada
  if (quadrosUsados.has(QUADRO_SST_ENTRADA)) {
    for (const a of automacoesRoteamentoSST()) {
      L.push(`insert into public.gestao_automacoes (id, id_quadro, nome, ativo, gatilho, condicao, acao, ordem) select gen_random_uuid(), ${q(QUADRO_SST_ENTRADA)}, ${q(a.nome)}, true, ${q(a.gatilho)}, ${qj(a.condicao)}, ${qj(a.acao)}, 0 where not exists (select 1 from public.gestao_automacoes where id_quadro = ${q(QUADRO_SST_ENTRADA)} and nome = ${q(a.nome)});`);
    }
  }

  // 5) asserções
  const ids = mapeados.map((m) => m.runrun_form_id);
  L.push(`do $$ declare n int; begin`);
  L.push(`  select count(*) into n from public.gestao_formularios where runrun_form_id in (${ids.join(",")});`);
  L.push(`  if n <> ${ids.length} then raise exception 'esperava ${ids.length} forms importados, achou %', n; end if;`);
  L.push(`  select count(*) into n from public.gestao_formularios f where f.runrun_form_id is not null and not exists (select 1 from public.gestao_status s where s.id_quadro = f.id_quadro and s.slug = f.status_inicial);`);
  L.push(`  if n <> 0 then raise exception '% forms com status_inicial sem coluna no quadro-alvo', n; end if;`);
  L.push(`  select count(*) into n from public.gestao_formularios f where f.runrun_form_id is not null and not exists (select 1 from public.gestao_quadros qd where qd.id_quadro = f.id_quadro);`);
  L.push(`  if n <> 0 then raise exception '% forms apontando para quadro inexistente', n; end if;`);
  if (quadrosUsados.has(QUADRO_SST_ENTRADA)) {
    L.push(`  select count(*) into n from public.gestao_automacoes where id_quadro = ${q(QUADRO_SST_ENTRADA)} and ativo;`);
    L.push(`  if n <> ${UNIDADES.length * 3} then raise exception 'roteamento SST: esperava ${UNIDADES.length * 3} automações, achou %', n; end if;`);
  }
  L.push(`end $$;`);
  L.push(`select f.runrun_form_id, f.id_quadro, f.status_inicial, f.ativo, jsonb_array_length(f.perguntas) perguntas, f.token from public.gestao_formularios f where f.runrun_form_id is not null order by f.id_quadro, f.titulo;`);
  L.push(`commit;`);
  writeFileSync(opc.sql, L.join("\n") + "\n", "utf8");
  console.log(`SQL gravado em ${opc.sql} (${L.length} linhas).`);
}

principal();
