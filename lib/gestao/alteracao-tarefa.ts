// Regras de alteração de tarefa compartilhadas entre a janela da tarefa (TarefaModal) e a edição
// direto na Lista (VistaLista). Antes só a janela travava a conclusão por dependências e gravava o
// histórico (gestao_atividades); mudar o status pela Lista pulava as duas coisas.

type TarefaMin = { titulo: string; status: string };

/** Pré-requisitos ainda não concluídos que impedem concluir a tarefa. Dependência de tarefa que não
 *  está no mapa (outra lista, sem leitura) não trava — mesma regra que a janela já usava. */
export function pendenciasParaConcluir<T extends TarefaMin>(
  dependeDe: string[],
  tarefas: Map<string, T>,
  tipoDoStatus: (slug: string) => string | undefined,
): T[] {
  return dependeDe
    .map((id) => tarefas.get(id))
    .filter((t): t is T => !!t && tipoDoStatus(t.status) !== "concluido");
}

/** Texto do aviso quando a trava de conclusão segura a mudança. */
export function mensagemPendencias(pendentes: TarefaMin[]): string {
  return `Conclua antes: ${pendentes.map((t) => t.titulo).join(", ")}`;
}

export interface EventoAtividade {
  acao: string;
  payload?: Record<string, unknown>;
}

type CamposHistorico = {
  status: string;
  responsavel: string | null;
  prazo: string | null;
  prioridade: string;
  titulo: string;
};

/** Eventos do histórico para uma edição. `depois` traz só o que mudou de lugar (na Lista, um campo
 *  por vez); chave ausente não gera evento. Mesmo formato de payload que a janela gravava. */
export function eventosAlteracao(
  antes: CamposHistorico,
  depois: Partial<CamposHistorico>,
  nomeStatus: (slug: string) => string,
): EventoAtividade[] {
  const ev: EventoAtividade[] = [];
  if (depois.status !== undefined && depois.status !== antes.status) {
    ev.push({ acao: "status", payload: { de: nomeStatus(antes.status), para: nomeStatus(depois.status) } });
  }
  if (depois.responsavel !== undefined && (depois.responsavel ?? null) !== (antes.responsavel ?? null)) {
    ev.push({ acao: "responsavel", payload: { de: antes.responsavel ?? "—", para: depois.responsavel ?? "—" } });
  }
  if (depois.prazo !== undefined && (depois.prazo || null) !== (antes.prazo ?? null)) {
    ev.push({ acao: "prazo", payload: { de: antes.prazo ?? "—", para: depois.prazo || "—" } });
  }
  if (depois.prioridade !== undefined && depois.prioridade !== antes.prioridade) {
    ev.push({ acao: "prioridade", payload: { de: antes.prioridade, para: depois.prioridade } });
  }
  if (depois.titulo !== undefined && depois.titulo !== antes.titulo) {
    ev.push({ acao: "titulo", payload: { de: antes.titulo, para: depois.titulo } });
  }
  return ev;
}
