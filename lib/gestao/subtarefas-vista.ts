// Filtro "Mostrar" do quadro/lista: transforma as subtarefas de um quadro em itens das vistas.
// As filhas já abertas (v300) entram como são; as linhas sem filha viram cartões de exibição
// (`sub_linha`), com status pelo "feito" e o resto herdado só no que faz sentido (quadro/unidade).

import type { GestaoStatus, GestaoTarefa, SubtarefaDoQuadro } from "@/lib/hooks/useGestao";
import type { MostrarItens } from "@/lib/gestao/filtros";

export type { MostrarItens };
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

/** Vínculo mínimo para a troca abaixo. */
export interface VinculoMin { usuario_email: string; tipo: string; origem?: string | null }

/**
 * 0.3.320 (pedido do João, 26/11): quem vê "só as próprias" e está num cartão SÓ por causa de uma subtarefa (o único
 * vínculo dele é o seguidor com origem 'subtarefa-mae', v368 = v375 do Painel) vê no quadro um cartão por subtarefa
 * DELE, no lugar do cartão principal. Quem está vinculado ao cartão de outro jeito (responsável, seguidor posto à mão,
 * importação) ou o criou continua vendo o cartão principal. Sem subtarefa dele carregada, o cartão fica (nada some).
 *
 * Devolve as tarefas sem esses cartões e as subtarefas que entram no lugar deles.
 */
export function trocarMaesPorMinhasSubtarefas(p: {
  tarefas: GestaoTarefa[];
  subtarefas: GestaoTarefa[];
  linhas: Pick<SubtarefaDoQuadro, "id" | "responsavel_email">[];
  eu: string | null | undefined;
  vinculadosDe: (idTarefa: string) => readonly VinculoMin[];
  criouEu?: (t: GestaoTarefa) => boolean;
}): { tarefas: GestaoTarefa[]; minhas: GestaoTarefa[] } {
  const eu = (p.eu ?? "").trim().toLowerCase();
  if (!eu) return { tarefas: p.tarefas, minhas: [] };
  const meus = (id: string) => p.vinculadosDe(id).filter((v) => v.usuario_email.toLowerCase() === eu);
  const respLinha = new Map(p.linhas.map((l) => [l.id, (l.responsavel_email ?? "").toLowerCase()]));
  const subDeMim = (s: GestaoTarefa) =>
    s.sub_linha ? respLinha.get(s.sub_linha) === eu : meus(s.id_tarefa).some((v) => v.tipo === "responsavel");
  const tarefas: GestaoTarefa[] = [];
  const minhas: GestaoTarefa[] = [];
  for (const t of p.tarefas) {
    const v = meus(t.id_tarefa);
    const soPelaSub = v.length > 0 && v.every((x) => x.origem === "subtarefa-mae") && !p.criouEu?.(t);
    const subs = soPelaSub ? p.subtarefas.filter((s) => s.id_tarefa_pai === t.id_tarefa && subDeMim(s)) : [];
    if (subs.length) minhas.push(...subs);
    else tarefas.push(t);
  }
  return { tarefas, minhas };
}

/** Itens das vistas conforme o filtro "Mostrar". */
export function itensMostrar(mostrar: MostrarItens, tarefas: GestaoTarefa[], subtarefas: GestaoTarefa[]): GestaoTarefa[] {
  if (mostrar === "tarefas") return tarefas;
  if (mostrar === "subtarefas") return subtarefas;
  return [...tarefas, ...subtarefas];
}
