/**
 * De-para Runrun.it → Gestão para o board SST (594810) — GESTAO-KANBAN-01 F4-SST. Puro e testável.
 *
 * O Runrun modela a checklist de produtos como TAREFAS-FILHAS (is_subtask + parent_task_id);
 * o Gestão modela como itens de gestao_subtarefas da tarefa-mãe. Logo: tarefa-pai → gestao_tarefas
 * no quadro da UNIDADE; tarefa-filha → gestao_subtarefas (texto/feito/etapa/responsável).
 * A unidade vem da tag (`tags_data`), senão do `client_name`, senão da tag/cliente do pai;
 * sem unidade → "SST — Entrada" (QDR-SSTENTRA), onde alguém etiqueta e a automação move.
 * Medido em 2026-09-21: 20.622 tarefas = 2.175 pais + 18.447 filhas; 99,6% com unidade derivável.
 */

import { htmlParaTexto, tipoParaPrioridade, normalizarEtiqueta } from "@/lib/gestao/import/runrun-mapa";
import { UNIDADES, QUADRO_SST_ENTRADA, CAMPO_PRODUTOS_ID, CAMPO_TIPO_CLIENTE_ID } from "@/lib/gestao/import/runrun-forms-mapa";

// ── Entrada (campos usados do /tasks e do /users) ────────────────────────────────
export interface RRAssignment { assignee_id: string; assignee_name?: string | null; is_closed?: boolean }
export interface RRTaskSST {
  id: number;
  title: string;
  is_closed: boolean;
  is_subtask?: boolean;
  parent_task_id?: number | null;
  subtask_ids?: number[];
  board_stage_name: string;
  type_name?: string | null;
  user_id?: string | null;
  user_name?: string | null;
  assignments?: RRAssignment[];
  tags_data?: { name: string }[];
  client_name?: string | null;
  custom_fields?: Record<string, { label: string } | { label: string }[] | null>;
  desired_date?: string | null;
  desired_start_date?: string | null;
  close_date?: string | null;
  created_at: string;
  points?: number | null;
  is_urgent?: boolean;
  attachments_count?: number;
  subtask_parent_position?: number | null;
  queue_position?: number | null;
  board_stage_position?: number | null;
  description?: string | null; // só no detalhe (/tasks/:id)
}
export interface RRUser { id: string; email?: string | null; name?: string | null }

// ── Etapas do SST (16 colunas das unidades, slugs medidos em 2026-09-18) ─────────
export const ETAPAS_SST: Record<string, string> = {
  "empresas novas": "EMPRESAS_NOVAS",
  "fiscalizacao": "FISCALIZACAO",
  "empresas fora da regiao": "EMPRESAS_FORA_REGIAO",
  "servicos": "SERVICOS",
  "avaliacoes de quantitativos": "AVAL_QUANTITATIVOS",
  "documentacoes retroativas": "DOC_RETROATIVAS",
  "revisoes a fazer": "REVISOES_A_FAZER",
  "aguardando retorno do cliente": "AG_RETORNO_CLIENTE",
  "aguardando agendamento": "AG_AGENDAMENTO",
  "agendado": "AGENDADO",
  "inspecao pendente": "INSPECAO_PENDENTE",
  "inspecao na pasta": "INSPECAO_NA_PASTA",
  "elaboracao dos programas": "ELABORACAO_PROGRAMAS",
  "aguardando aprovacao": "AG_APROVACAO",
  "concluida": "CONCLUIDA",
  "inativas/inadimplentes": "INATIVAS_INADIMPLENTES",
};
export const NOME_ETAPA: Record<string, string> = {
  EMPRESAS_NOVAS: "Empresas Novas", FISCALIZACAO: "Fiscalização", EMPRESAS_FORA_REGIAO: "Empresas fora da Região",
  SERVICOS: "Serviços", AVAL_QUANTITATIVOS: "Avaliações de Quantitativos", DOC_RETROATIVAS: "Documentações Retroativas",
  REVISOES_A_FAZER: "Revisões a Fazer", AG_RETORNO_CLIENTE: "Aguardando Retorno do Cliente", AG_AGENDAMENTO: "Aguardando Agendamento",
  AGENDADO: "Agendado", INSPECAO_PENDENTE: "Inspeção Pendente", INSPECAO_NA_PASTA: "Inspeção na Pasta",
  ELABORACAO_PROGRAMAS: "Elaboração dos programas", AG_APROVACAO: "Aguardando Aprovação", CONCLUIDA: "Concluída",
  INATIVAS_INADIMPLENTES: "Inativas/Inadimplentes",
};
const ETAPAS_CONCLUIDAS = new Set(["CONCLUIDA", "INATIVAS_INADIMPLENTES"]);

const semAcento = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Etapa do Runrun → slug da unidade. Desconhecida → null (o script aborta com lista). */
export function slugEtapaSST(nome: string | null | undefined): string | null {
  return ETAPAS_SST[semAcento(nome)] ?? null;
}

// ── Unidade ──────────────────────────────────────────────────────────────────────
export interface Unidade { id_quadro: string; tag: string; via: "tag" | "cliente" | "pai" }

function unidadePorTexto(txt: string): { id_quadro: string; tag: string } | null {
  const s = semAcento(txt);
  if (!s) return null;
  for (const u of UNIDADES) {
    const chave = semAcento(u.tag);
    const curta = chave.replace(/^nova /, ""); // "nova friburgo" também casa "friburgo"
    if (s === chave || s.includes(chave) || s.includes(curta)) return { id_quadro: u.id_quadro, tag: u.tag };
  }
  return null;
}

export function unidadeDe(t: RRTaskSST, porId: Map<number, RRTaskSST>): Unidade | null {
  for (const tg of t.tags_data ?? []) { const u = unidadePorTexto(tg.name); if (u) return { ...u, via: "tag" }; }
  const c = unidadePorTexto(t.client_name ?? ""); if (c) return { ...c, via: "cliente" };
  if (t.parent_task_id) {
    const pai = porId.get(t.parent_task_id);
    if (pai) { const up = unidadeDe(pai, porId); if (up) return { ...up, via: "pai" }; }
  }
  return null;
}

// ── Saída ─────────────────────────────────────────────────────────────────────────
export interface LinhaTarefaSST {
  id_tarefa: string; id_quadro: string; runrun_id: number; titulo: string; descricao: string | null;
  /** Nome legado quando o responsável do Runrun NÃO tem e-mail (desligado): fica visível no card sem vínculo. */
  responsavel: string | null;
  status: string; prioridade: string; prazo: string | null; data_inicio: string | null; ordem: number;
  etiquetas: string[]; campos: Record<string, string | string[]>; pontos: number | null;
  created_at: string; updated_at: string | null; origem: Record<string, unknown>;
}
export interface LinhaSubtarefaSST {
  id: string; id_tarefa: string; texto: string; feito: boolean; ordem: number; etapa: string | null; responsavel_email: string | null;
  created_at: string;
}
export interface LinhaVinculoSST { id_tarefa: string; email: string; tipo: "responsavel" | "seguidor" }
export interface LinhaLogSST { runrun_id: number; id_tarefa: string | null; resultado: "ok" | "nao_casado" | "sem_unidade" | "etapa_desconhecida" | "sem_pai"; detalhe: string }

export const idTarefaSST = (runrunId: number) => `RRN-${runrunId}`;
export const idSubtarefaSST = (runrunId: number) => `SRR-${runrunId}`;

const soData = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : null);

/** e-mail do usuário do Runrun por id (slug). Sem e-mail → null (vira "não casado" no log). */
export function emailDe(userId: string | null | undefined, users: Map<string, RRUser>): string | null {
  if (!userId) return null;
  const e = (users.get(userId)?.email ?? "").trim().toLowerCase();
  return e || null;
}

export function camposDe(t: RRTaskSST): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  const cf = t.custom_fields ?? {};
  const prod = cf["custom_86"];
  if (Array.isArray(prod)) { const labels = prod.map((o) => o.label.trim()).filter(Boolean); if (labels.length) out[CAMPO_PRODUTOS_ID] = labels; }
  const tipo = cf["custom_100"];
  if (tipo && !Array.isArray(tipo) && tipo.label) out[CAMPO_TIPO_CLIENTE_ID] = tipo.label.trim();
  return out;
}

export interface ResultadoMapa {
  tarefas: LinhaTarefaSST[]; subtarefas: LinhaSubtarefaSST[]; vinculos: LinhaVinculoSST[]; log: LinhaLogSST[];
  statusNecessarios: { id_quadro: string; slug: string; nome: string }[];
  stats: Record<string, number>;
}

/**
 * Mapeia o board inteiro. `descricoes` = mapa runrun_id → HTML do detalhe (opcional).
 * Tarefa-filha sem pai no lote → log `sem_pai` (não vira tarefa solta).
 */
export function mapearBoardSST(tasks: RRTaskSST[], users: Map<string, RRUser>, descricoes: Map<number, string | null> = new Map()): ResultadoMapa {
  const porId = new Map(tasks.map((t) => [t.id, t]));
  const tarefas: LinhaTarefaSST[] = []; const subtarefas: LinhaSubtarefaSST[] = []; const vinculos: LinhaVinculoSST[] = []; const log: LinhaLogSST[] = [];
  const statusSet = new Map<string, { id_quadro: string; slug: string; nome: string }>();
  const stats: Record<string, number> = { pais: 0, filhas: 0, sem_unidade: 0, via_tag: 0, via_cliente: 0, via_pai: 0, nao_casados: 0, etapa_desconhecida: 0, sem_pai: 0, com_descricao: 0 };
  const pais = tasks.filter((t) => !t.is_subtask);
  const filhas = tasks.filter((t) => !!t.is_subtask);

  const vincular = (id_tarefa: string, t: RRTaskSST): string | null => {
    const vistos = new Set<string>();
    let nomeSemEmail: string | null = null;
    const add = (userId: string | null | undefined, tipo: "responsavel" | "seguidor") => {
      if (!userId) return;
      const email = emailDe(userId, users);
      if (!email) {
        log.push({ runrun_id: t.id, id_tarefa, resultado: "nao_casado", detalhe: `${tipo}: ${userId} sem e-mail no Runrun` }); stats.nao_casados++;
        if (tipo === "responsavel") nomeSemEmail = (t.assignments ?? []).find((a) => a.assignee_id === userId)?.assignee_name ?? (t.user_id === userId ? t.user_name ?? null : null) ?? userId;
        return;
      }
      if (vistos.has(email)) return;
      vistos.add(email); vinculos.push({ id_tarefa, email, tipo });
    };
    const asg = (t.assignments ?? []).map((a) => a.assignee_id).filter(Boolean);
    if (asg.length) { add(asg[0], "responsavel"); asg.slice(1).forEach((a) => add(a, "seguidor")); if (t.user_id) add(t.user_id, "seguidor"); }
    else add(t.user_id, "responsavel");
    return nomeSemEmail;
  };

  for (const t of pais) {
    stats.pais++;
    const slug = slugEtapaSST(t.board_stage_name);
    if (!slug) { log.push({ runrun_id: t.id, id_tarefa: null, resultado: "etapa_desconhecida", detalhe: t.board_stage_name }); stats.etapa_desconhecida++; continue; }
    const un = unidadeDe(t, porId);
    const id_quadro = un?.id_quadro ?? QUADRO_SST_ENTRADA;
    if (un) stats[`via_${un.via}`]++; else { stats.sem_unidade++; log.push({ runrun_id: t.id, id_tarefa: idTarefaSST(t.id), resultado: "sem_unidade", detalhe: `${t.title} → SST — Entrada (${t.board_stage_name})` }); }
    const prio = tipoParaPrioridade(t.type_name);
    // A tag de unidade fica no formato que o roteamento usa ("nova friburgo"); as demais no slug do mapa.
    const etiquetas = [...new Set([un ? un.tag : "", ...prio.etiquetasExtra, ...(t.tags_data ?? []).map((x) => normalizarEtiqueta(x.name))].filter(Boolean))];
    const descHtml = descricoes.get(t.id);
    const descricao = descHtml ? htmlParaTexto(descHtml) || null : null;
    if (descricao) stats.com_descricao++;
    const id_tarefa = idTarefaSST(t.id);
    statusSet.set(`${id_quadro}|${slug}`, { id_quadro, slug, nome: NOME_ETAPA[slug] ?? slug });
    const responsavelLegado = vincular(id_tarefa, t);
    tarefas.push({
      id_tarefa, id_quadro, runrun_id: t.id, titulo: t.title.trim() || `Runrun #${t.id}`, descricao,
      responsavel: responsavelLegado ? `${responsavelLegado} (sem conta)` : null,
      status: slug, prioridade: t.is_urgent ? "Urgente" : prio.prioridade,
      prazo: soData(t.desired_date), data_inicio: soData(t.desired_start_date),
      ordem: Number.isFinite(t.board_stage_position) ? Math.min(Math.round((t.board_stage_position as number) / 1e12), 2_000_000_000) : 0,
      etiquetas, campos: camposDe(t), pontos: t.points ?? null,
      created_at: t.created_at, updated_at: t.close_date ?? null,
      origem: { fonte: "runrun.it", board_id: 594810, stage: t.board_stage_name, type: t.type_name ?? null, client: t.client_name ?? null,
        tags: (t.tags_data ?? []).map((x) => x.name), unidade_via: un?.via ?? null, is_closed: t.is_closed, close_date: t.close_date ?? null,
        attachments_count: t.attachments_count ?? 0, user_id: t.user_id ?? null, url: `https://runrun.it/tasks/${t.id}` },
    });
    log.push({ runrun_id: t.id, id_tarefa, resultado: "ok", detalhe: `${id_quadro}/${slug}` });
  }

  const ordemFilha = new Map<number, number>();
  for (const p of pais) (p.subtask_ids ?? []).forEach((sid, i) => ordemFilha.set(sid, i));
  for (const s of filhas) {
    stats.filhas++;
    const pai = s.parent_task_id ? porId.get(s.parent_task_id) : undefined;
    if (!pai || pai.is_subtask) { log.push({ runrun_id: s.id, id_tarefa: null, resultado: "sem_pai", detalhe: `${s.title} (pai ${s.parent_task_id ?? "?"})` }); stats.sem_pai++; continue; }
    const slugPai = slugEtapaSST(pai.board_stage_name);
    if (!slugPai) continue; // pai já foi para o log
    const asg = (s.assignments ?? []).map((a) => a.assignee_id).filter(Boolean);
    const quem = asg[0] ?? s.user_id;
    const resp = emailDe(quem, users);
    if (quem && !resp) { log.push({ runrun_id: s.id, id_tarefa: idTarefaSST(pai.id), resultado: "nao_casado", detalhe: `subtarefa "${s.title}": ${quem} sem e-mail` }); stats.nao_casados++; }
    const etapa = slugEtapaSST(s.board_stage_name);
    subtarefas.push({
      id: idSubtarefaSST(s.id), id_tarefa: idTarefaSST(pai.id), texto: s.title.trim() || `#${s.id}`,
      feito: !!s.is_closed || ETAPAS_CONCLUIDAS.has(etapa ?? ""), ordem: ordemFilha.get(s.id) ?? (s.subtask_parent_position ?? 0),
      etapa, responsavel_email: resp, created_at: s.created_at,
    });
  }
  return { tarefas, subtarefas, vinculos, log, statusNecessarios: [...statusSet.values()], stats };
}
