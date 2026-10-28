"use client";

import { Flag, Pencil } from "lucide-react";
import { COR_PRIORIDADE, ROTULO_PRIORIDADE, motivosPrioridade, textoEspera, type Prioridade } from "@/lib/inspecoes/prioridade";
import { fmtData, cn } from "@/lib/utils";
import type { Inspecao } from "@/lib/supabase/types";

/**
 * Prioridade de uma inspeção (v306): o selo da prioridade EFETIVA (maior entre a do supervisor e
 * a automática), o tempo de espera e o prazo. O "porquê" vai no balão. `onEditar` (supervisor)
 * abre o modal de prioridade/prazo.
 */
export default function SeloPrioridade({ insp, onEditar, compacto }: { insp: Inspecao; onEditar?: (i: Inspecao) => void; compacto?: boolean }) {
  const p = insp.prioridade_efetiva as Prioridade | null | undefined;
  const motivos = motivosPrioridade(insp);
  const espera = textoEspera(insp.status, insp.dias_espera);
  const dica = [p ? `Prioridade ${ROTULO_PRIORIDADE[p]}` : "Sem prioridade", ...motivos, insp.prioridade ? "" : p ? "(calculada automaticamente)" : ""]
    .filter(Boolean)
    .join("\n");

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span className="inline-flex items-center gap-1">
        {p ? (
          <span title={dica} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", COR_PRIORIDADE[p])}>
            <Flag className="size-3" /> {ROTULO_PRIORIDADE[p]}
            {!insp.prioridade && <span className="font-normal opacity-60">auto</span>}
          </span>
        ) : (
          <span className="text-xs text-gray-300" title={dica}>—</span>
        )}
        {onEditar && (
          <button type="button" onClick={() => onEditar(insp)} title="Definir prioridade e prazo (supervisor)" className="flex size-5 items-center justify-center rounded text-gray-300 hover:bg-verde-light hover:text-verde-primary">
            <Pencil className="size-3" />
          </button>
        )}
      </span>
      {!compacto && espera && <span className="text-[11px] text-gray-400">{espera}</span>}
      {insp.prazo && (
        <span className={cn("text-[11px]", motivos.some((m) => m.startsWith("Prazo vencido")) ? "font-medium text-red-600" : "text-gray-500")}>
          prazo {fmtData(insp.prazo)}
        </span>
      )}
    </span>
  );
}
