import { normalizarTexto } from "@/lib/busca/texto";

/**
 * Página Agenda da Gestão (10/11/2026): o texto de cada atividade no calendário.
 *  - Com empresa (a da tarefa ou, numa subtarefa, a da tarefa-mãe): "Empresa · título" — quem olha sabe onde ir.
 *    Se o título já traz o nome da empresa (comparação sem acento e sem maiúsculas), fica só o título.
 *  - Sem empresa, a subtarefa leva a tarefa-mãe: "título · mãe". A tarefa sem empresa fica só com o título.
 * Puro (testado em agenda.test.ts).
 */
export function tituloNaAgenda(
  t: { titulo: string; id_tarefa_pai?: string | null; titulo_mae?: string | null },
  empresa: string | null | undefined,
): string {
  const titulo = (t.titulo ?? "").trim();
  const emp = (empresa ?? "").trim();
  if (emp) return normalizarTexto(titulo).includes(normalizarTexto(emp)) ? titulo : `${emp} · ${titulo}`;
  if (t.id_tarefa_pai && t.titulo_mae?.trim()) return `${titulo} · ${t.titulo_mae.trim()}`;
  return titulo;
}
