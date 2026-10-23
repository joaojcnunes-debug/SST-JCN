// Filtro "Mostrar" do quadro/lista: transforma as subtarefas de um quadro em itens das vistas.
// As filhas já abertas (v300) entram como são; as linhas sem filha viram cartões de exibição
// (`sub_linha`), com status pelo "feito" e o resto herdado só no que faz sentido (quadro/unidade).

import type { GestaoStatus, GestaoTarefa, SubtarefaDoQuadro } from "@/lib/hooks/useGestao";

export type MostrarItens = "tarefas" | "subtarefas" | "ambas";
export const SUB_PREFIXO = "SUB:";

/** Slug do status equivalente ao "feito" da linha (mesma régua de gestao_status_para_feito). */
export function statusDoFeito(statuses: Pick<GestaoStatus, "slug" | "tipo" | "ordem">[], feito: boolean): string {
  const ord = [...statuses].sort((a, b) => a.ordem - b.ordem);
  if (feito) return ord.find((s) => s.tipo === "concluido")?.slug ?? "CONCLUIDO";
  return (ord.find((s) => s.tipo === "nao_iniciado") ?? ord.find((s) => s.tipo !== "concluido"))?.slug ?? "A_FAZER";
}

export function montarSubtarefas(p: {
  maes: GestaoTarefa[];
  linhas: SubtarefaDoQuadro[];
  filhas: GestaoTarefa[];
  statuses: Pick<GestaoStatus, "slug" | "tipo" | "ordem">[];
  nomeDe: (email: string) => string | null;
}): GestaoTarefa[] {
  const maes = new Map(p.maes.map((t) => [t.id_tarefa, t]));
  const out: GestaoTarefa[] = p.filhas.map((f) => ({ ...f, titulo_mae: f.id_tarefa_pai ? maes.get(f.id_tarefa_pai)?.titulo : undefined }));
  const comFilha = new Set(p.filhas.map((f) => f.id_tarefa));
  for (const l of p.linhas) {
    if (l.id_tarefa_filha && comFilha.has(l.id_tarefa_filha)) continue;
    const mae = maes.get(l.id_tarefa);
    if (!mae) continue;
    out.push({
      ...mae,
      id_tarefa: SUB_PREFIXO + l.id,
      sub_linha: l.id,
      id_tarefa_pai: mae.id_tarefa,
      titulo_mae: mae.titulo,
      titulo: l.texto,
      descricao: null,
      status: statusDoFeito(p.statuses, l.feito),
      responsavel: l.responsavel_email ? (p.nomeDe(l.responsavel_email) ?? l.responsavel_email) : null,
      prazo: null,
      data_inicio: null,
      hora_inicio: null,
      hora_fim: null,
      ordem: 100000 + (l.ordem ?? 0),
      etiquetas: [],
      subtarefas: [],
      campos: {},
      recorrencia: null,
      pontos: null,
      created_at: l.created_at,
      updated_at: null,
    });
  }
  return out;
}

/** Itens das vistas conforme o filtro "Mostrar". */
export function itensMostrar(mostrar: MostrarItens, tarefas: GestaoTarefa[], subtarefas: GestaoTarefa[]): GestaoTarefa[] {
  if (mostrar === "tarefas") return tarefas;
  if (mostrar === "subtarefas") return subtarefas;
  return [...tarefas, ...subtarefas];
}
