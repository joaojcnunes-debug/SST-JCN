// v297 — a ação da automação tem o que precisa para rodar? Mesma regra do banco
// (gestao_automacao_completa): automação incompleta não fica ativa.
// v298 — várias ações por regra (gestao_automacao_completa_lista): todas precisam estar completas.

export interface AcaoMin {
  tipo?: string;
  valor?: string;
  campo_id?: string;
  emails?: unknown;
  id_quadro_destino?: string;
  modelo_slug?: string;
  texto?: string;
  assunto?: string;
  para?: string;
  dias?: string;
  quantidade?: string;
  unidade?: string;
}

const tem = (v: unknown) => typeof v === "string" && v.trim() !== "";
const temLista = (v: unknown) => Array.isArray(v) && v.length > 0;

export function acaoCompleta(acao: AcaoMin | null | undefined): boolean {
  if (!acao?.tipo) return false;
  switch (acao.tipo) {
    case "mover_status":
    case "mover_status_se_completo":
    case "definir_responsavel":
    case "definir_prioridade":
    case "adicionar_etiqueta":
    case "remover_etiqueta":
      return tem(acao.valor);
    case "definir_campo":
      return tem(acao.campo_id);
    case "adicionar_vinculados":
      return temLista(acao.emails);
    case "mover_tarefa_quadro":
    case "criar_tarefa_quadro":
      return tem(acao.id_quadro_destino);
    case "criar_subtarefas_modelo":
      return tem(acao.modelo_slug);
    case "comentar":
      return tem(acao.texto);
    case "enviar_email":
      return tem(acao.assunto) && (acao.para === "vinculados" || acao.para === "responsaveis" || temLista(acao.emails));
    case "definir_prazo":
      return typeof acao.dias === "string" && /^-?\d+$/.test(acao.dias);
    case "aguardar":
      return typeof acao.quantidade === "string" && /^\d+$/.test(acao.quantidade) && Number(acao.quantidade) > 0
        && ["horas", "dias"].includes(acao.unidade ?? "dias");
    case "notificar":
    case "solicitar_aprovacao":
    case "concluir":
    case "duplicar_tarefa":
      return true;
    default:
      return false;
  }
}

/** A regra inteira: ao menos uma ação, e todas completas. */
export function acoesCompletas(acoes: readonly (AcaoMin | null | undefined)[] | null | undefined): boolean {
  return !!acoes && acoes.length > 0 && acoes.every((a) => acaoCompleta(a));
}

/** Lista de ações da regra: `acoes` (v298) ou, em regra antiga, a `acao` única. */
export function acoesDaRegra<T extends AcaoMin>(r: { acoes?: T[] | null; acao?: T | null }): T[] {
  if (r.acoes && r.acoes.length > 0) return r.acoes;
  return r.acao?.tipo ? [r.acao] : [];
}

// ── v299: a regra depende também do gatilho (mesma regra de gestao_automacao_regra_completa) ──

export interface AgendaMin { freq?: string; hora?: string; dias_semana?: unknown; dia_mes?: string }
export interface ModeloTarefaMin { titulo?: string; prazo_dias?: string }
export interface CondicaoMin {
  agenda?: AgendaMin;
  modo?: string;
  modelo_tarefa?: ModeloTarefaMin;
  parada?: { quantidade?: string };
}

export function agendaValida(a: AgendaMin | null | undefined): boolean {
  if (!a || !/^([01]\d|2[0-3]):[0-5]\d$/.test(a.hora ?? "")) return false;
  switch (a.freq) {
    case "diaria":
    case "dias_uteis":
      return true;
    case "semanal":
      return temLista(a.dias_semana);
    case "mensal":
      return /^([1-9]|[12]\d|3[01]|ultimo)$/.test(a.dia_mes ?? "");
    default:
      return false;
  }
}

export function modeloTarefaValido(m: ModeloTarefaMin | null | undefined): boolean {
  return !!m && tem(m.titulo) && (!m.prazo_dias || /^-?\d+$/.test(m.prazo_dias));
}

/** A regra está completa para o gatilho escolhido? (incompleta não fica ativa) */
export function regraCompleta(gatilho: string, condicao: CondicaoMin | null | undefined, acoes: readonly (AcaoMin | null | undefined)[]): boolean {
  const c = condicao ?? {};
  if (gatilho === "agendado") {
    if (!agendaValida(c.agenda)) return false;
    if ((c.modo ?? "cada_tarefa") === "criar_tarefa") return modeloTarefaValido(c.modelo_tarefa) && (acoes.length === 0 || acoesCompletas(acoes));
    return acoesCompletas(acoes);
  }
  if (gatilho === "tarefa_parada") {
    const q = c.parada?.quantidade ?? "";
    return /^\d+$/.test(q) && Number(q) > 0 && acoesCompletas(acoes);
  }
  return acoesCompletas(acoes);
}
