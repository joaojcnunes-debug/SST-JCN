"use client";

import type { StatusInspecao } from "@/lib/supabase/types";
import { STATUS_INSPECAO_CONFIG } from "@/lib/constants";
import { useTema } from "@/lib/store";

export default function StatusBadge({ status }: { status: StatusInspecao }) {
  const cfg = STATUS_INSPECAO_CONFIG[status] ?? STATUS_INSPECAO_CONFIG.RASCUNHO;
  const escuro = useTema((s) => s.tema) === "dark";
  // No claro devolvo o cfg cru — é exatamente o que o painel sempre mostrou.
  // No escuro, 14%/57%: par medido que mantém as 9 cores de status e nível
  // acima de 4,5 (pior caso, DELETADA, dá 4,82). A fórmula anterior valia nos
  // dois temas e deixava estes 4 badges entre 3,41 e 3,93 no escuro.
  // Não entra em laudo nem PDF, então pode ler o tema direto.
  const estilo = escuro
    ? {
        color: `color-mix(in srgb, ${cfg.cor} 57%, var(--text-strong))`,
        backgroundColor: `color-mix(in srgb, ${cfg.cor} 14%, var(--surface))`,
        borderColor: `color-mix(in srgb, ${cfg.cor} 40%, var(--border-app))`,
      }
    : { color: cfg.cor, backgroundColor: cfg.bg, borderColor: cfg.borda };

  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
      style={estilo}
    >
      {cfg.label}
    </span>
  );
}
