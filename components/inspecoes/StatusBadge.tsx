import type { StatusInspecao } from "@/lib/supabase/types";
import { STATUS_INSPECAO_CONFIG } from "@/lib/constants";

export default function StatusBadge({ status }: { status: StatusInspecao }) {
  const cfg = STATUS_INSPECAO_CONFIG[status] ?? STATUS_INSPECAO_CONFIG.RASCUNHO;
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ color: cfg.cor, backgroundColor: cfg.bg, borderColor: cfg.borda }}
    >
      {cfg.label}
    </span>
  );
}
