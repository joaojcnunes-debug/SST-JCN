// v297 — a ação da automação tem o que precisa para rodar? Mesma regra do banco
// (gestao_automacao_completa): automação incompleta não fica ativa.

export interface AcaoMin {
  tipo?: string;
  valor?: string;
  campo_id?: string;
  emails?: unknown;
  id_quadro_destino?: string;
  modelo_slug?: string;
}

const tem = (v: unknown) => typeof v === "string" && v.trim() !== "";

export function acaoCompleta(acao: AcaoMin | null | undefined): boolean {
  if (!acao?.tipo) return false;
  switch (acao.tipo) {
    case "mover_status":
    case "mover_status_se_completo":
    case "definir_responsavel":
    case "definir_prioridade":
      return tem(acao.valor);
    case "definir_campo":
      return tem(acao.campo_id);
    case "adicionar_vinculados":
      return Array.isArray(acao.emails) && acao.emails.length > 0;
    case "mover_tarefa_quadro":
    case "criar_tarefa_quadro":
      return tem(acao.id_quadro_destino);
    case "criar_subtarefas_modelo":
      return tem(acao.modelo_slug);
    case "notificar":
    case "solicitar_aprovacao":
      return true;
    default:
      return false;
  }
}
