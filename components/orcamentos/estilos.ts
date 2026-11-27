import type { SituacaoOrcamento } from "@/lib/orcamentos/modelo";

/** 0.3.339: as cores da situação do orçamento (lista e página do orçamento). */
export const COR_SITUACAO: Record<SituacaoOrcamento, string> = {
  rascunho: "bg-gray-100 text-gray-700 ring-gray-200",
  enviado: "bg-sky-50 text-sky-800 ring-sky-200",
  aprovado: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  recusado: "bg-red-50 text-red-700 ring-red-200",
};

/** 0.3.340: campo e rótulo dos formulários do orçamento (editor e seções dos modelos). */
export const inp =
  "w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-marca-primary focus:outline-none focus:ring-2 focus:ring-marca-primary/20 disabled:bg-gray-50 disabled:text-gray-600";
export const rot = "block text-xs font-semibold text-gray-600";
