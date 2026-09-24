"use client";

import type { NivelRisco } from "@/lib/supabase/types";
import { NIVEL_CONFIG } from "@/lib/constants";
import { useTema } from "@/lib/store";

export default function NivelBadge({ nivel }: { nivel: NivelRisco | string }) {
  const cfg =
    (NIVEL_CONFIG as Record<string, (typeof NIVEL_CONFIG)[NivelRisco]>)[nivel] ??
    NIVEL_CONFIG.Baixo;
  const escuro = useTema((s) => s.tema) === "dark";
  // Claro = cfg cru, idêntico ao que o painel mostra hoje. Escuro = 14%/57%,
  // o par medido que segura as 9 cores acima de 4,5.
  //
  // ATENÇÃO ao mexer: no CLARO estes badges já têm contraste baixo em produção
  // (Trivial 3,00 · Baixo 2,85 · Moderado 2,86 · Alto 3,95 — o piso é 4,5),
  // porque o texto 600 fica sobre o pastel 100 da mesma cor. É condição
  // pré-existente, NÃO foi introduzida aqui, e melhorá-la muda o visual do
  // tema claro — decisão do usuário, não efeito colateral do modo noturno.
  const estilo = escuro
    ? {
        color: `color-mix(in srgb, ${cfg.cor} 57%, var(--text-strong))`,
        backgroundColor: `color-mix(in srgb, ${cfg.cor} 14%, var(--surface))`,
        borderColor: `color-mix(in srgb, ${cfg.cor} 40%, var(--border-app))`,
      }
    : { color: cfg.cor, backgroundColor: cfg.bg, borderColor: cfg.borda };

  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap"
      style={estilo}
    >
      {nivel}
    </span>
  );
}
