"use client";

import AnimatedNumber from "./AnimatedNumber";

export interface SaudeDocumentos {
  total: number;
  emDia: number;
  vencendo: number;
  vencido: number;
  semValidade: number;
}

const R = 58;
const SW = 14;
const C = 2 * Math.PI * R;

const SEGS: { key: keyof SaudeDocumentos; cor: string }[] = [
  { key: "emDia", cor: "#16a34a" },
  { key: "vencendo", cor: "#f59e0b" },
  { key: "vencido", cor: "#dc2626" },
  { key: "semValidade", cor: "#e2e2dd" },
];

/** Anel circular segmentado: % de documentos com validade informada, com a
 *  composição (em dia / a vencer / vencido / sem validade). */
export default function SaudeAnel({ saude }: { saude: SaudeDocumentos }) {
  const total = Math.max(1, saude.total);
  const comValidade = saude.emDia + saude.vencendo + saude.vencido;
  const pct = Math.round((comValidade / total) * 100);
  let acc = 0;

  return (
    <div className="flex items-center gap-5">
      <div className="relative size-[140px] shrink-0">
        <svg viewBox="0 0 140 140" className="size-full -rotate-90">
          <circle cx="70" cy="70" r={R} fill="none" stroke="#f1f1ee" strokeWidth={SW} />
          {SEGS.map((s) => {
            const v = saude[s.key];
            const dash = (v / total) * C;
            const el = (
              <circle
                key={s.key}
                cx="70"
                cy="70"
                r={R}
                fill="none"
                stroke={s.cor}
                strokeWidth={SW}
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-acc}
                style={{ transition: "stroke-dasharray .9s ease, stroke-dashoffset .9s ease" }}
              />
            );
            acc += dash;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[26px] font-bold leading-none text-gray-900">
            <AnimatedNumber value={pct} />%
          </span>
          <span className="mt-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
            com validade
          </span>
        </div>
      </div>

      <div className="space-y-1.5 text-sm">
        <Legenda cor="#16a34a" label="Em dia" valor={saude.emDia} />
        <Legenda cor="#f59e0b" label="A vencer (60d)" valor={saude.vencendo} />
        <Legenda cor="#dc2626" label="Vencidos" valor={saude.vencido} />
        <Legenda cor="#cbd5e1" label="Sem validade" valor={saude.semValidade} />
      </div>
    </div>
  );
}

function Legenda({ cor, label, valor }: { cor: string; label: string; valor: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: cor }} />
      <span className="flex-1 whitespace-nowrap text-gray-600">{label}</span>
      <span className="font-semibold text-gray-900">{valor}</span>
    </div>
  );
}
