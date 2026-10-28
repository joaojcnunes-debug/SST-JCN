/**
 * Complexidade da inspeção (v308 do JCN, 28/10/2026).
 *
 * Mesma mecânica da prioridade: marcada na coluna da lista de Inspeções por quem edita a
 * inspeção; nula = não definida. Manual (não há complexidade calculada). Os valores são os do
 * CHECK do banco (inspecoes_complexidade_check).
 */

export type ComplexidadeInspecao = "BAIXA" | "MEDIA" | "ALTA" | "MUITO_ALTA";

/** Da mais simples para a mais complexa — a ordem do seletor. */
export const COMPLEXIDADES: readonly ComplexidadeInspecao[] = ["BAIXA", "MEDIA", "ALTA", "MUITO_ALTA"];

/** Da mais complexa para a mais simples — a ordem das pílulas do filtro. */
export const COMPLEXIDADES_DESC: readonly ComplexidadeInspecao[] = ["MUITO_ALTA", "ALTA", "MEDIA", "BAIXA"];

export const COMPLEXIDADE_INFO: Record<ComplexidadeInspecao, { label: string; classe: string }> = {
  BAIXA: { label: "Baixa", classe: "bg-gray-100 text-gray-700 border-gray-200" },
  MEDIA: { label: "Média", classe: "bg-sky-50 text-sky-800 border-sky-200" },
  ALTA: { label: "Alta", classe: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  MUITO_ALTA: { label: "Muito alta", classe: "bg-violet-100 text-violet-800 border-violet-200" },
};

export function ehComplexidade(v: unknown): v is ComplexidadeInspecao {
  return typeof v === "string" && (COMPLEXIDADES as readonly string[]).includes(v);
}
