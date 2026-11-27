import type { SituacaoOrcamento } from "@/lib/orcamentos/modelo";

/** 0.3.339: as cores da situação do orçamento (lista e página do orçamento). */
export const COR_SITUACAO: Record<SituacaoOrcamento, string> = {
  rascunho: "bg-gray-100 text-gray-700 ring-gray-200",
  enviado: "bg-sky-50 text-sky-800 ring-sky-200",
  aprovado: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  recusado: "bg-red-50 text-red-700 ring-red-200",
};
