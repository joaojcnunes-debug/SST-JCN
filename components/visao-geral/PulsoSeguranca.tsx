"use client";

// Pulso de segurança (Etapa 4 do docs/plano-skin-viva-jcn.md): a nota de 0 a 100 com a linha de
// batimento na cor da faixa. A composição aparece ao passar o mouse (ou focar/tocar) no título —
// a nota tem que ser explicável. Fórmula e faixas em lib/visao-geral/pulso.ts.
// A linha anda só para quem não pediu menos movimento; não sai na impressão.

import Dica from "@/components/ui/Dica";
import AnimatedNumber from "./AnimatedNumber";
import { ROTULO_FAIXA, composicaoPulso, type FaixaPulso, type Pulso } from "@/lib/visao-geral/pulso";
import { cn } from "@/lib/utils";

const COR: Record<FaixaPulso, { texto: string; traco: string; selo: string }> = {
  em_dia: { texto: "text-emerald-600", traco: "#10b981", selo: "bg-emerald-50 text-emerald-700" },
  atencao: { texto: "text-amber-600", traco: "#f59e0b", selo: "bg-amber-50 text-amber-700" },
  critico: { texto: "text-red-600", traco: "#ef4444", selo: "bg-red-50 text-red-700" },
};

// Um batimento (ECG simplificado) repetido: plano, pico, vale, plano.
const ONDA =
  "M0 20 H22 L27 20 L31 6 L35 32 L39 14 L42 20 H70 L75 20 L79 6 L83 32 L87 14 L90 20 H118 L123 20 L127 6 L131 32 L135 14 L138 20 H160";

export default function PulsoSeguranca({ pulso, loading }: { pulso?: Pulso; loading?: boolean }) {
  const cor = pulso?.faixa ? COR[pulso.faixa] : null;
  return (
    <div
      className="tilt-3d reveal-up w-full rounded-2xl border border-gray-200 bg-white p-5 shadow-sm print:hidden lg:w-[320px]"
      style={{ animationDelay: "90ms" }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          {pulso ? <Dica texto={composicaoPulso(pulso)}>Pulso de segurança</Dica> : "Pulso de segurança"}
        </p>
        {pulso?.faixa && (
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", cor!.selo)}>
            {ROTULO_FAIXA[pulso.faixa]}
          </span>
        )}
      </div>
      {loading || !pulso ? (
        <div className="skeleton-shimmer mt-3 h-14" />
      ) : pulso.nota === null ? (
        <p className="mt-3 text-sm text-gray-500">
          <span className="text-3xl font-bold text-gray-300">—</span>
          <span className="mt-1 block text-xs">Sem documentos com validade informada para calcular a nota.</span>
        </p>
      ) : (
        <div className="mt-2 flex items-center gap-4">
          <p className={cn("text-5xl font-bold tabular-nums", cor!.texto)}>
            <AnimatedNumber value={pulso.nota} />
          </p>
          <svg viewBox="0 0 160 40" className="h-10 min-w-0 flex-1" aria-hidden="true">
            <path d={ONDA} fill="none" stroke="#e5e7eb" strokeWidth="2" className="dark:stroke-gray-700" />
            <path
              d={ONDA}
              fill="none"
              stroke={cor!.traco}
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pulso-onda"
            />
          </svg>
        </div>
      )}
      <p className="mt-2 text-[11px] text-gray-400">Documentos válidos (70%) e ações 5W2H no prazo (30%).</p>
    </div>
  );
}
