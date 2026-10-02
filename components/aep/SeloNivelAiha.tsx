"use client";

import { COR_NIVEL_AIHA } from "@/lib/aep/aiha-organizacional";
import { cn } from "@/lib/utils";

/** Selo do nível na matriz AIHA (cores da inspeção). null = "Não calculado". */
export default function SeloNivelAiha({ nivel, className }: { nivel: string | null; className?: string }) {
  if (!nivel) {
    return (
      <span
        className={cn("inline-block rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-[11px] text-gray-500", className)}
        title="Nenhum sinal observado marcado (ou AEP ainda não salva)"
      >
        Não calculado
      </span>
    );
  }
  const c = COR_NIVEL_AIHA[nivel as keyof typeof COR_NIVEL_AIHA];
  return (
    <span
      className={cn("inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold", className)}
      style={{ backgroundColor: c?.bg, color: c?.cor, borderColor: c?.borda }}
    >
      {nivel}
    </span>
  );
}
