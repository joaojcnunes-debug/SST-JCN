import type { NivelRisco } from "@/lib/supabase/types";
import { NIVEL_CONFIG } from "@/lib/constants";

export default function NivelBadge({ nivel }: { nivel: NivelRisco | string }) {
  const cfg =
    (NIVEL_CONFIG as Record<string, (typeof NIVEL_CONFIG)[NivelRisco]>)[nivel] ??
    NIVEL_CONFIG.Baixo;
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap"
      style={{ color: cfg.cor, backgroundColor: cfg.bg, borderColor: cfg.borda }}
    >
      {nivel}
    </span>
  );
}
