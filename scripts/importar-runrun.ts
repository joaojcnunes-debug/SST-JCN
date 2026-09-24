/**
 * scripts/importar-runrun.ts — GESTAO-KANBAN-01-F4
 *
 * Importa cartoes do Runrun.it para o modulo Gestao JCN Consultoria do painel-sst.
 * NAO e rota: e um Node standalone, FORA do bundle do app, rodado pelo OPERADOR com
 * a service key. Nao ha execucao no browser nem no servidor Next.
 *
 * ─── Como rodar (o `--import` do carregador resolve o atalho `@/`) ─────────────────
 *   RUNRUN_APP_KEY=...  RUNRUN_USER_TOKEN=...  \
 *   POSTGREST_INTERNAL_URL=http://127.0.0.1:54321  POSTGREST_SERVICE_TOKEN=... \
 *   node --import ./scripts/testes/carregador.mjs scripts/importar-runrun.ts \
 *        --board <id_runrun> [--dry-run] [--desde 2026-01-01]
 *
 * O PostgREST nao publica porta: aponte POSTGREST_INTERNAL_URL para a ponta do tunel
 * (deploy/dev-tunnel.ps1) — mesmo padrao de scripts/vincular-responsaveis.mjs.
 *
 * ─── Contrato de seguranca (STRIDE) ────────────────────────────────────────────────
 *  • Credenciais SO de process.env (Runrun App-Key/User-Token; PostgREST service token).
 *    Nada e lido de disco, nada e hardcoded. Sem token em log/erro (mascarado).
 *  • Sem SSRF: a base do Runrun e uma CONSTANTE (RUNRUN_BASE); `--board` e coado a inteiro;
 *    nenhuma URL vem de dado do usuario/da API.
 *  • Idempotente: upsert por runrun_id (tarefa), por (id_tarefa,usuario_email,tipo) (vinculo),
 *    por id deterministico (subtarefa). 2x sem duplicar.
 *  • --dry-run NAO escreve: so faz GET (leitura) e imprime o plano + o relatorio de nao-casados.
 *
 * ─── Limites conhecidos (o operador confere no --dry-run antes de aplicar) ──────────
 *  • O mapeamento de negocio (tipo/etapa/tags/alocados/HTML) vive em lib/gestao/import/
 *    runrun-mapa.ts, testado offline. Aqui so ha fetch + extracao de campo + escrita.
 *  • Comentarios/anexos ficam FORA do piloto (§6). Subtarefas sao lidas do campo embutido
 *    do cartao; se a conta modelar subtarefa como tarefa-filha, o dry-run mostra zero e o
 *    operador sinaliza antes de ligar a escrita.
 */

import {
  tipoParaPrioridade,
  etapaParaStatus,
  normalizarEtiquetas,
  resolverVinculos,
  htmlParaTexto,
  mapearCamposTarefa,
  type AlocadoEntrada,
  type NaoCasado,
  type StatusMapeado,
  type CampoDef,
  type RunrunCampoBruto,
} from "@/lib/gestao/import/runrun-mapa";

// ── Constantes ─────────────────────────────────────────────────────────────────
const RUNRUN_BASE = "https://runrun.it/api/v1.0"; // fixo: sem SSRF
const PAGINA = 100; // teto por pagina da API do Runrun
const LOTE_ESCRITA = 200;
// Quadro-catalogo dos campos personalizados (Produtos/Tipo de Cliente ja semeados). As defs do
// quadro RR-<board> sao COPIADAS daqui (mesmo tipo/opcoes) — SGG do de-para de campo (GE4).
const QUADRO_CATALOGO = "QDR-GERAL01";
// No --dry-run, quando a listagem NAO traz custom fields, buscamos o detalhe de ate N tarefas
// (amostra do C3). O import real busca de TODAS.
const AMOSTRA_CAMPOS = 25;

// ── Flags ─────────────────────────────────────────────────────────────────────
interface Opcoes {
  board: number;
  dryRun: boolean;
  desde: string | null;
  semCampos: boolean;
}

function lerFlags(argv: string[]): Opcoes {
  let board: number | null = null;
  let dryRun = false;
  let desde: string | null = null;
  let semCampos = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") dryRun = true;
    else if (a === "--sem-campos") semCampos = true;
    else if (a === "--board") board = coarInteiro(argv[++i], "--board");
    else if (a.startsWith("--board=")) board = coarInteiro(a.slice("--board=".length), "--board");
    else if (a === "--desde") desde = coarData(argv[++i]);
    else if (a.startsWith("--desde=")) desde = coarData(a.slice("--desde=".length));
  }
  if (board === null) {
    throw new Error("Falta --board <id_runrun> (inteiro). Ex.: --board 598871 (Suporte T.I).");
  }
  return { board, dryRun, desde, semCampos };
}

function coarInteiro(v: string | undefined, flag: string): number {
  const n = Number(v);
  if (!v || !Number.isInteger(n) || n <= 0) {
    throw new Error(`${flag} deve ser um inteiro positivo; recebido: ${JSON.stringify(v)}`);
  }
  return n;
}

function coarData(v: string | undefined): string {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    throw new Error(`--desde deve ser uma data AAAA-MM-DD; recebido: ${JSON.stringify(v)}`);
  }
  return v;
}

// ── Ambiente (credenciais SO de process.env) ────────────────────────────────────
interface Ambiente {
  runrunAppKey: string;
  runrunUserToken: string;
  postgrestBase: string;
  serviceToken: string;
}

function lerAmbiente(dryRun: boolean): Ambiente {
  const runrunAppKey = process.env.RUNRUN_APP_KEY ?? "";
  const runrunUserToken = process.env.RUNRUN_USER_TOKEN ?? "";
  const postgrestBase = (process.env.POSTGREST_INTERNAL_URL ?? "").replace(/\/$/, "");
  const serviceToken = process.env.POSTGREST_SERVICE_TOKEN ?? "";
  const faltando: string[] = [];
  // Runrun e SEMPRE obrigatorio. O PostgREST so e obrigatorio para ESCREVER (import real);
  // no --dry-run ele e OPCIONAL: se ausente, o casamento de alocados por e-mail e pulado
  // (o relatorio de nao-casados sai como "PULADO — sem DB"); todo o resto do de-para nao precisa
  // do banco. O import real (sem --dry-run) segue exigindo os dois (escreve via service_role).
  if (!runrunAppKey) faltando.push("RUNRUN_APP_KEY");
  if (!runrunUserToken) faltando.push("RUNRUN_USER_TOKEN");
  if (!dryRun) {
    if (!postgrestBase) faltando.push("POSTGREST_INTERNAL_URL");
    if (!serviceToken) faltando.push("POSTGREST_SERVICE_TOKEN");
  }
  if (faltando.length) {
    throw new Error(
      `Variaveis de ambiente ausentes: ${faltando.join(", ")}.\n` +
        `Exporte-as (Runrun via SOPS; PostgREST do .env.local) antes de rodar.` +
        (dryRun ? "" : `\n(No --dry-run so RUNRUN_* sao obrigatorias.)`),
    );
  }
  return { runrunAppKey, runrunUserToken, postgrestBase, serviceToken };
}

// ── Tipos crus da API do Runrun (campos opcionais: extraidos com defesa) ─────────
interface RunrunUser {
  id: number;
  email?: string | null;
  name?: string | null;
}
interface RunrunStage {
  id: number;
  name?: string | null;
  position?: number | null;
}
interface RunrunType {
  id: number;
  name?: string | null;
}
interface RunrunTagObj {
  id?: number;
  name?: string | null;
}
interface RunrunAssignment {
  assignee_id?: number | null;
}
interface RunrunSubtask {
  title?: string | null;
  name?: string | null;
  is_closed?: boolean | null;
  done?: boolean | null;
}
interface RunrunTask {
  id: number;
  title?: string | null;
  board_id?: number | null;
  board_stage_id?: number | null;
  type_id?: number | null;
  desired_date?: string | null;
  desired_start_date?: string | null;
  start_date?: string | null;
  description?: string | null;
  assignments?: RunrunAssignment[] | null;
  responsible_id?: number | null;
  follower_ids?: number[] | null;
  tags?: (RunrunTagObj | string)[] | null;
  subtasks?: RunrunSubtask[] | null;
  updated_at?: string | null;
  created_at?: string | null;
  // Campos personalizados: a chave/forma varia por conta/versao da API v1.0. Extraidos com
  // defesa por extrairCamposBrutos(); podem NAO vir na listagem (so no GET /tasks/{id}).
  custom_fields?: unknown;
  task_custom_fields?: unknown;
  custom_field_values?: unknown;
}
interface RunrunBoard {
  id: number;
  name?: string | null;
  // board_stages NAO e usado: a API REST v1.0 nao popula as etapas aqui — elas vem do
  // endpoint dedicado /board_stages?board_id={id} (ver listarStages no fluxo principal).
}

// ── HTTP Runrun (GET only) ──────────────────────────────────────────────────────
function cabecalhosRunrun(env: Ambiente): Record<string, string> {
  return {
    "App-Key": env.runrunAppKey,
    "User-Token": env.runrunUserToken,
    "Content-Type": "application/json",
  };
}

async function getRunrun<T>(env: Ambiente, caminho: string): Promise<T> {
  const url = `${RUNRUN_BASE}${caminho}`;
  let r: Response;
  try {
    r = await fetch(url, { headers: cabecalhosRunrun(env) });
  } catch (e) {
    throw explicarRede(e, url);
  }
  if (!r.ok) {
    throw new Error(`GET ${caminho} -> ${r.status} ${r.statusText}\n${await r.text()}`);
  }
  return (await r.json()) as T;
}

/**
 * Pagina a listagem de tarefas por board. O /tasks do Runrun v1.0 retorna SO tarefas ABERTAS
 * (is_closed=false) por padrao — sem isto as etapas fechadas (Concluida/Concluidos), que sao a
 * maioria no board SST, nao viriam. Buscamos os dois estados (false E true) e deduplicamos por id.
 */
async function listarTarefas(env: Ambiente, board: number): Promise<RunrunTask[]> {
  const todas: RunrunTask[] = [];
  const vistos = new Set<number>();
  for (const fechado of [false, true]) {
    for (let pagina = 1; ; pagina++) {
      const lote = await getRunrun<RunrunTask[]>(
        env,
        `/tasks?board_id=${board}&is_closed=${fechado}&limit=${PAGINA}&page=${pagina}`,
      );
      if (!Array.isArray(lote) || lote.length === 0) break;
      for (const t of lote) {
        if (!vistos.has(t.id)) {
          vistos.add(t.id);
          todas.push(t);
        }
      }
      if (lote.length < PAGINA) break; // ultima pagina deste estado
      if (pagina > 1000) throw new Error("paginacao excedeu 1000 paginas — abortando por seguranca");
    }
  }
  return todas;
}

// ── HTTP PostgREST (leitura sempre; escrita so fora do dry-run) ──────────────────
function cabecalhosPg(env: Ambiente, extra?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Bearer ${env.serviceToken}`,
    apikey: env.serviceToken,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function pgGet<T>(env: Ambiente, caminho: string): Promise<T> {
  const url = `${env.postgrestBase}/${caminho}`;
  let r: Response;
  try {
    r = await fetch(url, { headers: cabecalhosPg(env) });
  } catch (e) {
    throw explicarRede(e, url);
  }
  if (!r.ok) throw new Error(`GET ${caminho} -> ${r.status}\n${await r.text()}`);
  return (await r.json()) as T;
}

/** POST/upsert. `onConflict` liga a resolucao por merge; sem ele e insert puro. */
async function pgUpsert(
  env: Ambiente,
  tabela: string,
  linhas: unknown[],
  onConflict?: string,
): Promise<void> {
  if (linhas.length === 0) return;
  const q = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : "";
  const prefer = onConflict ? "resolution=merge-duplicates,return=minimal" : "return=minimal";
  const url = `${env.postgrestBase}/${tabela}${q}`;
  for (let i = 0; i < linhas.length; i += LOTE_ESCRITA) {
    const lote = linhas.slice(i, i + LOTE_ESCRITA);
    let r: Response;
    try {
      r = await fetch(url, {
        method: "POST",
        headers: cabecalhosPg(env, { Prefer: prefer }),
        body: JSON.stringify(lote),
      });
    } catch (e) {
      throw explicarRede(e, url);
    }
    if (!r.ok) throw new Error(`POST ${tabela} (${r.status}): ${await r.text()}`);
  }
}

function explicarRede(e: unknown, url: string): Error {
  const causa =
    (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
    (e as { code?: string })?.code;
  if (causa === "ECONNREFUSED" || causa === "ETIMEDOUT" || causa === "ENOTFOUND") {
    return new Error(
      `Nao consegui falar com ${url} (${causa}). Se for o PostgREST, abra o tunel ` +
        `(deploy/dev-tunnel.ps1) numa outra janela e rode de novo.`,
    );
  }
  return e instanceof Error ? e : new Error(String(e));
}

// ── Modelos de linha da Gestao ───────────────────────────────────────────────────
interface LinhaTarefa {
  id_tarefa: string;
  id_quadro: string;
  runrun_id: number;
  origem: unknown;
  titulo: string;
  descricao: string;
  status: string;
  prioridade: string;
  prazo: string | null;
  etiquetas: string[];
  /** jsonb {id_campo(uuid): valor} — so presente quando capturarCampos; ja MERGE do existente. */
  campos?: Record<string, string | string[]>;
}
interface LinhaVinculo {
  id_tarefa: string;
  usuario_email: string;
  tipo: string;
  origem: string;
}
interface LinhaSubtarefa {
  id: string;
  id_tarefa: string;
  texto: string;
  feito: boolean;
  ordem: number;
}
interface LinhaLog {
  runrun_id: number | null;
  id_tarefa: string | null;
  board_runrun: string;
  resultado: string;
  detalhe: string;
}

// ── Extracao de campos do cartao (defensiva) ─────────────────────────────────────
function nomesTags(t: RunrunTask): string[] {
  const tags = t.tags ?? [];
  return tags.map((x) => (typeof x === "string" ? x : (x.name ?? ""))).filter(Boolean);
}

function idsAlocados(t: RunrunTask): number[] {
  const ass = (t.assignments ?? [])
    .map((a) => a.assignee_id)
    .filter((n): n is number => typeof n === "number");
  // responsible_id primeiro (se houver), sem duplicar.
  if (typeof t.responsible_id === "number") {
    return [t.responsible_id, ...ass.filter((n) => n !== t.responsible_id)];
  }
  return ass;
}

function paraAlocado(id: number, porId: Map<number, RunrunUser>): AlocadoEntrada {
  const u = porId.get(id);
  return { email: u?.email ?? null, nome: u?.name ?? null };
}

function prazoDaTarefa(t: RunrunTask): string | null {
  const bruto = t.desired_date ?? null;
  if (!bruto) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(bruto); // gestao_tarefas.prazo e DATE
  return m ? m[1] : null;
}

function dataDaTarefa(t: RunrunTask): string | null {
  const bruto = t.updated_at ?? t.created_at ?? null;
  if (!bruto) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(bruto);
  return m ? m[1] : null;
}

function extrairSubtarefas(t: RunrunTask): { texto: string; feito: boolean }[] {
  return (t.subtasks ?? [])
    .map((s) => ({
      texto: (s.title ?? s.name ?? "").trim(),
      feito: Boolean(s.is_closed ?? s.done ?? false),
    }))
    .filter((s) => s.texto);
}

/**
 * Custom fields de uma tarefa: a API v1.0 pode expor num array sob custom_fields /
 * task_custom_fields / custom_field_values (varia por conta). Retorna o primeiro array de
 * objetos encontrado. A INTERPRETACAO de cada entrada (nome/valor) fica no de-para puro
 * (mapearCamposTarefa) — aqui so isolamos o array cru.
 */
function extrairCamposBrutos(fonte: Record<string, unknown>): RunrunCampoBruto[] {
  for (const k of ["custom_fields", "task_custom_fields", "custom_field_values"]) {
    const v = fonte[k];
    if (Array.isArray(v)) {
      return v.filter((x): x is RunrunCampoBruto => !!x && typeof x === "object" && !Array.isArray(x));
    }
  }
  return [];
}

// ── Fluxo principal ──────────────────────────────────────────────────────────────
async function principal(): Promise<void> {
  const opc = lerFlags(process.argv.slice(2));
  const env = lerAmbiente(opc.dryRun);
  const idQuadro = `RR-${opc.board}`;
  // No dry-run sem PostgREST, o casamento por e-mail e pulado (relatorio de nao-casados indisponivel).
  const checarContas = Boolean(env.postgrestBase && env.serviceToken);

  console.log(`\n${opc.dryRun ? "MODO SECO — nada sera escrito" : "APLICANDO"}`);
  console.log(`board Runrun ..... ${opc.board}`);
  console.log(`quadro Gestao .... ${idQuadro}`);
  console.log(`--desde .......... ${opc.desde ?? "(sem filtro)"}\n`);

  // 1) Metadados do board + catalogos (leitura).
  const board = await getRunrun<RunrunBoard>(env, `/boards/${opc.board}`);
  const nomeBoard = board.name ?? String(opc.board);
  // As etapas NAO vem embutidas em /boards/{id} (board_stages sai vazio na API REST v1.0) ->
  // toda tarefa cairia em stageNome="" -> status default `ativo`. Buscar no endpoint DEDICADO.
  const stages = await getRunrun<RunrunStage[]>(env, `/board_stages?board_id=${opc.board}`);
  const stagePorId = new Map<number, RunrunStage>(stages.map((s) => [s.id, s]));
  if (stages.length === 0) {
    console.log(`AVISO: /board_stages?board_id=${opc.board} veio vazio — verifique o board id.`);
  }

  const tipos = await getRunrun<RunrunType[]>(env, `/task_types`);
  const tipoPorId = new Map<number, string>(tipos.map((t) => [t.id, t.name ?? ""]));

  const usuarios = await getRunrun<RunrunUser[]>(env, `/users`);
  const usuarioPorId = new Map<number, RunrunUser>(usuarios.map((u) => [u.id, u]));

  // Contas do painel (para casar alocados por e-mail). No dry-run sem DB, pula-se o casamento:
  // contasPorEmail = null sinaliza "nao checar" (todos os alocados viram vinculo otimista, sem
  // relatorio de nao-casados). O import real sempre tem DB e faz o casamento de verdade.
  let contasPorEmail: Set<string> | null = null;
  if (checarContas) {
    const contasPainel = await pgGet<{ email: string | null }[]>(
      env,
      `usuarios?select=email&limit=20000`,
    );
    contasPorEmail = new Set(
      contasPainel.map((c) => (c.email ?? "").trim().toLowerCase()).filter(Boolean),
    );
  } else {
    console.log(
      `casamento por e-mail .... PULADO (sem PostgREST no dry-run — relatorio de nao-casados indisponivel)\n`,
    );
  }

  // 2) Tarefas (paginadas), filtradas por --desde.
  let tarefas = await listarTarefas(env, opc.board);
  if (opc.desde) {
    const desde = opc.desde;
    tarefas = tarefas.filter((t) => {
      const d = dataDaTarefa(t);
      return d === null || d >= desde;
    });
  }
  console.log(`tarefas no board ......... ${tarefas.length}`);

  // 2b) Campos personalizados (GE4). A listagem pode NAO trazer os custom fields; se nenhuma tarefa
  //     os trouxer inline, buscamos o detalhe (GET /tasks/{id}) — TODAS no import real, uma AMOSTRA
  //     no dry-run (C3). --sem-campos pula tudo.
  const capturarCampos = !opc.semCampos;
  const camposBrutos = new Map<number, RunrunCampoBruto[]>();
  if (!capturarCampos) {
    console.log(`campos personalizados .... PULADO (--sem-campos)`);
  } else {
    let algumInline = false;
    for (const t of tarefas) {
      const inl = extrairCamposBrutos(t as unknown as Record<string, unknown>);
      if (inl.length > 0) {
        camposBrutos.set(t.id, inl);
        algumInline = true;
      }
    }
    if (!algumInline && tarefas.length > 0) {
      const limite = opc.dryRun ? Math.min(AMOSTRA_CAMPOS, tarefas.length) : tarefas.length;
      const amostra = opc.dryRun && limite < tarefas.length;
      console.log(
        `campos: listagem sem custom fields -> buscando DETALHE de ${limite} tarefa(s)` +
          (amostra ? ` (AMOSTRA do dry-run; o import real le todas as ${tarefas.length}).` : `.`),
      );
      for (let i = 0; i < limite; i++) {
        const t = tarefas[i];
        const det = await getRunrun<Record<string, unknown>>(env, `/tasks/${t.id}`);
        const c = extrairCamposBrutos(det);
        if (c.length > 0) camposBrutos.set(t.id, c);
      }
    }
  }

  // 3) Monta as linhas + relatorio de nao-casados.
  const linhasTarefa: LinhaTarefa[] = [];
  const linhasVinculo: LinhaVinculo[] = [];
  const linhasSubtarefa: LinhaSubtarefa[] = [];
  const linhasLog: LinhaLog[] = [];
  const statusUsados = new Map<string, StatusMapeado>();
  let totalNaoCasados = 0;

  for (const t of tarefas) {
    const stageNome =
      (typeof t.board_stage_id === "number" ? stagePorId.get(t.board_stage_id)?.name : null) ?? "";
    const tipoNome = (typeof t.type_id === "number" ? tipoPorId.get(t.type_id) : null) ?? "";

    const status = etapaParaStatus(stageNome);
    statusUsados.set(status.slug, status);

    const prio = tipoParaPrioridade(tipoNome);
    const etiquetas = normalizarEtiquetas([...nomesTags(t), ...prio.etiquetasExtra]);

    const idTarefa = `RRN-${t.id}`;
    linhasTarefa.push({
      id_tarefa: idTarefa,
      id_quadro: idQuadro,
      runrun_id: t.id,
      origem: {
        fonte: "runrun",
        board_id: opc.board,
        board_nome: nomeBoard,
        etapa: stageNome,
        tipo: tipoNome,
        tags: nomesTags(t),
        url: `https://runrun.it/tasks/${t.id}`,
      },
      titulo: (t.title ?? "").trim() || `Runrun #${t.id}`,
      descricao: htmlParaTexto(t.description),
      status: status.slug,
      prioridade: prio.prioridade,
      prazo: prazoDaTarefa(t),
      etiquetas,
    });

    // Vinculos.
    const alocados = idsAlocados(t).map((id) => paraAlocado(id, usuarioPorId));
    const seguidores = (t.follower_ids ?? []).map((id) => paraAlocado(id, usuarioPorId));
    // Com DB: casa contra as contas do painel. Sem DB (dry-run): passa um Set com os PROPRIOS
    // e-mails dos alocados, para que todos casem (vinculo otimista, zero nao-casados) reusando a
    // mesma funcao testada — o casamento real acontece no import (que sempre tem DB).
    const refContas =
      contasPorEmail ??
      new Set(
        [...alocados, ...seguidores]
          .map((a) => (a.email ?? "").trim().toLowerCase())
          .filter(Boolean),
      );
    const { vinculos, naoCasados } = resolverVinculos(alocados, seguidores, refContas);
    for (const v of vinculos) {
      linhasVinculo.push({
        id_tarefa: idTarefa,
        usuario_email: v.email,
        tipo: v.tipo,
        origem: "import:runrun",
      });
    }
    for (const nc of naoCasados) {
      totalNaoCasados++;
      linhasLog.push({
        runrun_id: t.id,
        id_tarefa: idTarefa,
        board_runrun: nomeBoard,
        resultado: nc.papelPretendido === "responsavel" ? "responsavel_nao_casado" : "seguidor_nao_casado",
        detalhe: descreverNaoCasado(nc),
      });
    }

    // Subtarefas (id deterministico por ordem -> idempotente).
    extrairSubtarefas(t).forEach((s, ordem) => {
      linhasSubtarefa.push({
        id: `SRR-${t.id}-${ordem}`,
        id_tarefa: idTarefa,
        texto: s.texto,
        feito: s.feito,
        ordem,
      });
    });

    linhasLog.push({
      runrun_id: t.id,
      id_tarefa: idTarefa,
      board_runrun: nomeBoard,
      resultado: "ok",
      detalhe: `status=${status.slug} prioridade=${prio.prioridade} vinculos=${vinculos.length} subtarefas=${extrairSubtarefas(t).length}`,
    });
  }

  // 4) Relatorio.
  console.log(`\n── plano ──`);
  console.log(`tarefas a upsertar ....... ${linhasTarefa.length}`);
  console.log(`vinculos a gravar ........ ${linhasVinculo.length}`);
  console.log(`subtarefas a gravar ...... ${linhasSubtarefa.length}`);
  console.log(`status distintos ......... ${statusUsados.size}`);
  console.log(
    `alocados NAO casados ..... ${checarContas ? totalNaoCasados : "PULADO (sem DB; so alocados sem e-mail sao listados)"}`,
  );

  if (totalNaoCasados > 0) {
    console.log(`\n── alocados sem conta no painel (irao para gestao_import_log) ──`);
    const naoOk = linhasLog.filter((l) => l.resultado.endsWith("_nao_casado"));
    for (const l of naoOk) console.log(`  #${l.runrun_id}  ${l.detalhe}`);
  }

  // 4b) Campos personalizados: preview (amostra) + contagens. Casados contra o catalogo (Geral)
  //     — mesmo tipo/opcoes que serao copiados para o quadro-alvo. C3: mostra o que gravaria.
  let catalogoCampos: CampoCatalogo[] = [];
  if (capturarCampos) {
    if (!checarContas) {
      console.log(
        `\ncampos personalizados .... preview SEM catalogo (sem PostgREST no dry-run) — campos crus lidos:`,
      );
      mostrarCamposCrus(tarefas, camposBrutos);
    } else {
      catalogoCampos = await lerCatalogoCampos(env);
      if (catalogoCampos.length === 0) {
        console.log(`\nAVISO: catalogo ${QUADRO_CATALOGO} vazio — nenhum campo sera capturado.`);
      } else {
        const idParaNome = new Map(catalogoCampos.map((d) => [d.id, d.nome]));
        const contagem = new Map<string, number>();
        let naoMapeadosTotal = 0;
        console.log(`\n── campos personalizados (amostra) ──`);
        let mostradas = 0;
        for (const t of tarefas) {
          const m = mapearCamposTarefa(camposBrutos.get(t.id), catalogoCampos);
          naoMapeadosTotal += m.naoMapeados.length;
          for (const id of Object.keys(m.campos)) {
            const nome = idParaNome.get(id) ?? id;
            contagem.set(nome, (contagem.get(nome) ?? 0) + 1);
          }
          if (mostradas < AMOSTRA_CAMPOS && Object.keys(m.campos).length > 0) {
            console.log(`  #${t.id} ${formatarCampos(m.campos, idParaNome)}`);
            mostradas++;
          }
        }
        for (const cat of catalogoCampos) {
          console.log(`  tarefas com ${cat.nome}: ${contagem.get(cat.nome) ?? 0}`);
        }
        console.log(`  valores nao-mapeados (irao para gestao_import_log): ${naoMapeadosTotal}`);
        if (mostradas === 0) {
          console.log(`  (nenhuma tarefa casou campo — confira nomes/opcoes vs ${QUADRO_CATALOGO})`);
        }
      }
    }
  }

  if (opc.dryRun) {
    console.log(`\nModo seco: nada foi escrito. Para gravar, rode sem --dry-run.\n`);
    return;
  }

  // 5) Escrita (fora do dry-run).
  //    5.1 quadro + status (so cria o que falta; slug unico por quadro).
  await garantirQuadro(env, idQuadro, nomeBoard);
  await garantirStatus(env, idQuadro, [...statusUsados.values()], stages);

  //    5.1b campos personalizados: garante as defs no quadro-alvo (copiadas do catalogo) e faz
  //         MERGE nao-destrutivo em gestao_tarefas.campos. Todas as linhas ganham `campos` (coluna
  //         uniforme p/ o bulk upsert); tarefa sem campo mapeado grava seus campos ATUAIS de volta.
  if (capturarCampos && catalogoCampos.length > 0) {
    const defsRR = await garantirCamposQuadro(env, idQuadro, catalogoCampos);
    const existentes = await lerCamposExistentes(env, idQuadro);
    for (const linha of linhasTarefa) {
      const m = mapearCamposTarefa(camposBrutos.get(linha.runrun_id), defsRR);
      const base = existentes.get(linha.runrun_id) ?? {};
      // MERGE: preserva outras chaves jsonb; as mapeadas (multi=set) sobrescrevem -> idempotente.
      linha.campos = { ...base, ...m.campos } as Record<string, string | string[]>;
      for (const nm of m.naoMapeados) {
        linhasLog.push({
          runrun_id: linha.runrun_id,
          id_tarefa: linha.id_tarefa,
          board_runrun: nomeBoard,
          resultado: "campo_nao_mapeado",
          detalhe: `${nm.campo ?? "(sem nome)"} = ${nm.valor ?? "(sem valor)"} [${nm.motivo}]`,
        });
      }
    }
    const nComCampos = linhasTarefa.filter(
      (l) => l.campos && Object.keys(l.campos).length > 0,
    ).length;
    console.log(`campos: defs garantidas em ${idQuadro} (${defsRR.length}); tarefas com campos: ${nComCampos}`);
  }

  //    5.2 tarefas (upsert por runrun_id).
  await pgUpsert(env, "gestao_tarefas", linhasTarefa, "runrun_id");
  //    5.3 vinculos (idempotente pela unique da v187).
  await pgUpsert(env, "gestao_tarefa_vinculados", linhasVinculo, "id_tarefa,usuario_email,tipo");
  //    5.4 subtarefas (upsert por id deterministico).
  await pgUpsert(env, "gestao_subtarefas", linhasSubtarefa, "id");
  //    5.5 log (append; sem conflito).
  await pgUpsert(env, "gestao_import_log", linhasLog);

  console.log(`\nImport concluido. Confira gestao_import_log (resultado <> 'ok').\n`);
}

function descreverNaoCasado(nc: NaoCasado): string {
  const quem = nc.nome ?? "(sem nome)";
  const email = nc.email ?? "(sem e-mail)";
  const motivo = nc.motivo === "sem_email" ? "sem e-mail no Runrun" : "e-mail sem conta no painel";
  return `${quem} <${email}> pretendia ${nc.papelPretendido}: ${motivo}`;
}

/** Formata {id_campo: valor} para o preview, trocando o uuid pelo nome legivel. */
function formatarCampos(
  campos: Record<string, string | string[]>,
  idParaNome: Map<string, string>,
): string {
  return Object.entries(campos)
    .map(([id, val]) => `${idParaNome.get(id) ?? id}=${Array.isArray(val) ? `[${val.join(", ")}]` : val}`)
    .join("  ");
}

/** Preview sem catalogo (dry-run sem DB): mostra os campos CRUS lidos da API, para conferir o shape. */
function mostrarCamposCrus(
  tarefas: RunrunTask[],
  camposBrutos: Map<number, RunrunCampoBruto[]>,
): void {
  let mostradas = 0;
  for (const t of tarefas) {
    const b = camposBrutos.get(t.id);
    if (!b || b.length === 0) continue;
    console.log(`  #${t.id} ${JSON.stringify(b).slice(0, 300)}`);
    if (++mostradas >= AMOSTRA_CAMPOS) break;
  }
  if (mostradas === 0) console.log(`  (nenhuma tarefa trouxe custom fields inline)`);
}

/** Cria o quadro da Gestao para o board Runrun, se ainda nao existir. */
async function garantirQuadro(env: Ambiente, idQuadro: string, nome: string): Promise<void> {
  const existe = await pgGet<{ id_quadro: string }[]>(
    env,
    `gestao_quadros?select=id_quadro&id_quadro=eq.${encodeURIComponent(idQuadro)}`,
  );
  if (existe.length > 0) return;
  await pgUpsert(env, "gestao_quadros", [
    { id_quadro: idQuadro, nome: `Runrun: ${nome}`, descricao: "Importado do Runrun.it (F4)" },
  ]);
}

/**
 * Semeia os status do quadro a partir das etapas usadas. Insere apenas os slugs ainda
 * ausentes (a unique (id_quadro,slug) + a leitura previa garantem idempotencia; gestao_status.id
 * e uuid obrigatorio sem default, entao geramos um por linha nova).
 */
async function garantirStatus(
  env: Ambiente,
  idQuadro: string,
  usados: StatusMapeado[],
  stages: RunrunStage[],
): Promise<void> {
  const existentes = await pgGet<{ slug: string }[]>(
    env,
    `gestao_status?select=slug&id_quadro=eq.${encodeURIComponent(idQuadro)}`,
  );
  const jaTem = new Set(existentes.map((e) => e.slug));
  const ordemPorNome = new Map<string, number>(
    stages.map((s, i) => [(s.name ?? "").trim(), typeof s.position === "number" ? s.position : i]),
  );
  const novos = usados
    .filter((s) => !jaTem.has(s.slug))
    .map((s) => ({
      id: globalThis.crypto.randomUUID(),
      id_quadro: idQuadro,
      slug: s.slug,
      nome: s.nome || s.slug,
      ordem: ordemPorNome.get(s.nome) ?? 0,
      tipo: s.tipo,
    }));
  await pgUpsert(env, "gestao_status", novos);
}

// ── Campos personalizados: catalogo (Geral) -> defs do quadro-alvo (GE4) ────────────
interface CampoCatalogo extends CampoDef {
  ordem: number;
}

/** Le as defs de campo do quadro-catalogo (QDR-GERAL01): Produtos(multi), Tipo de Cliente(selecao). */
async function lerCatalogoCampos(env: Ambiente): Promise<CampoCatalogo[]> {
  const linhas = await pgGet<
    { id: string; nome: string; tipo: string; opcoes: string[] | null; ordem: number | null }[]
  >(
    env,
    `gestao_campos?select=id,nome,tipo,opcoes,ordem&id_quadro=eq.${encodeURIComponent(QUADRO_CATALOGO)}&order=ordem`,
  );
  return linhas.map((l, i) => ({
    id: l.id,
    nome: l.nome,
    tipo: l.tipo,
    opcoes: l.opcoes ?? [],
    ordem: typeof l.ordem === "number" ? l.ordem : i,
  }));
}

/**
 * Garante as defs de campo no quadro-alvo (RR-<board>), copiando tipo/opcoes do catalogo (Geral).
 * gestao_campos NAO tem unique (id_quadro,nome) -> idempotencia por READ-existentes + INSERE-faltantes
 * (mesmo padrao de garantirStatus; equivale a "on conflict (id_quadro,nome) do nothing"). Retorna as
 * defs do quadro (existentes + criadas) com o `id` (uuid) que sera a CHAVE do jsonb.
 */
async function garantirCamposQuadro(
  env: Ambiente,
  idQuadro: string,
  catalogo: CampoCatalogo[],
): Promise<CampoDef[]> {
  const existentes = await pgGet<{ id: string; nome: string; tipo: string; opcoes: string[] | null }[]>(
    env,
    `gestao_campos?select=id,nome,tipo,opcoes&id_quadro=eq.${encodeURIComponent(idQuadro)}`,
  );
  const porNome = new Map<string, CampoDef>();
  for (const e of existentes) {
    porNome.set(e.nome, { id: e.id, nome: e.nome, tipo: e.tipo, opcoes: e.opcoes ?? [] });
  }
  const novos: unknown[] = [];
  for (const cat of catalogo) {
    if (porNome.has(cat.nome)) continue;
    const id = globalThis.crypto.randomUUID();
    novos.push({
      id,
      id_quadro: idQuadro,
      nome: cat.nome,
      tipo: cat.tipo,
      opcoes: cat.opcoes,
      ordem: cat.ordem,
      visivel_cliente: false,
    });
    porNome.set(cat.nome, { id, nome: cat.nome, tipo: cat.tipo, opcoes: cat.opcoes });
  }
  await pgUpsert(env, "gestao_campos", novos);
  return [...porNome.values()];
}

/** Le gestao_tarefas.campos (jsonb) atuais do quadro, para MERGE nao-destrutivo por runrun_id. */
async function lerCamposExistentes(
  env: Ambiente,
  idQuadro: string,
): Promise<Map<number, Record<string, unknown>>> {
  const linhas = await pgGet<{ runrun_id: number | null; campos: Record<string, unknown> | null }[]>(
    env,
    `gestao_tarefas?select=runrun_id,campos&id_quadro=eq.${encodeURIComponent(idQuadro)}&limit=20000`,
  );
  const mapa = new Map<number, Record<string, unknown>>();
  for (const l of linhas) {
    if (typeof l.runrun_id === "number") mapa.set(l.runrun_id, l.campos ?? {});
  }
  return mapa;
}

principal().catch((e: unknown) => {
  console.error(`\nERRO: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
