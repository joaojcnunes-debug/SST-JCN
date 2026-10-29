// Conciliação DRPS/QPS × AEP (29/10/2026) — selos de classe e de nível, iguais na lista
// e no detalhe da empresa.

import type { ClasseConciliacao } from "@/lib/psico-consolidacao/conciliacao";
import { cn } from "@/lib/utils";

export const COR_CLASSE: Record<ClasseConciliacao, string> = {
  Convergente: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Nível divergente": "bg-red-50 text-red-700 ring-red-200",
  "Só questionário": "bg-orange-50 text-orange-700 ring-orange-200",
  "Só AEP": "bg-violet-50 text-violet-700 ring-violet-200",
  "Sem indicação": "bg-gray-50 text-gray-500 ring-gray-200",
  "Sem par": "bg-white text-gray-400 ring-gray-200",
};

export const EXPLICACAO_CLASSE: Record<ClasseConciliacao, string> = {
  Convergente: "Os dois apontam o fator, com nível parecido (até 1 degrau de diferença)",
  "Nível divergente": "Os dois apontam o fator, mas os níveis estão 2 ou mais degraus distantes",
  "Só questionário": "Os trabalhadores apontam o fator (Médio ou mais) e a AEP não viu",
  "Só AEP": "O técnico viu o fator (Moderado ou mais) e o questionário não aponta",
  "Sem indicação": "Nenhum dos dois aponta o fator",
  "Sem par": "O setor não aparece numa das fontes — não dá para conciliar",
};

export function SeloClasse({ classe, className }: { classe: ClasseConciliacao | null; className?: string }) {
  if (!classe) return <span className="text-xs text-gray-300">—</span>;
  return (
    <span
      title={EXPLICACAO_CLASSE[classe]}
      className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", COR_CLASSE[classe], className)}
    >
      {classe}
    </span>
  );
}

/** Cor do nível nas duas escalas (questionário e AIHA), pelo degrau 1–4. */
const COR_DEGRAU = ["text-gray-400", "text-gray-500", "text-amber-600", "text-orange-600", "text-red-600"];

export function TextoNivel({ texto, degrau }: { texto: string; degrau: number | null }) {
  return <span className={cn("font-medium", COR_DEGRAU[degrau ?? 0])}>{texto}</span>;
}
