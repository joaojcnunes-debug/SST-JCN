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
