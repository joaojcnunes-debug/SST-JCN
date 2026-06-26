"use client";

import { useState } from "react";
import {
  marcasDaVista, imgDaVista, PARTES, VIEWBOX, IMG_W, IMG_H, MARK, COR_SEL,
} from "@/lib/investigacao/corpo";

/**
 * Seletor de partes do corpo atingidas: a silhueta é a imagem do cliente
 * (frente/costas) e as marcas são anéis vermelhos clicáveis sobre o corpo.
 * Clicar na marca ou na lista alterna a seleção (sincronizadas).
 */
export default function BodyMap({
  value,
  onChange,
  ro,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  ro?: boolean;
}) {
  const [vista, setVista] = useState<"frente" | "costas">("frente");
  const has = (p: string) => value.includes(p);
  const toggle = (p: string) => {
    if (ro) return;
    onChange(has(p) ? value.filter((x) => x !== p) : [...value, p]);
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <div className="shrink-0">
        <div className="mb-1 inline-flex rounded-lg border border-gray-200 p-0.5 text-xs font-medium">
          {(["frente", "costas"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVista(v)}
              className={`rounded-md px-3 py-1 capitalize transition ${vista === v ? "bg-verde-primary text-white" : "text-gray-500 hover:bg-gray-100"}`}
            >
              {v}
            </button>
          ))}
        </div>
        <svg viewBox={VIEWBOX} className="h-[360px] w-auto select-none" role="img" aria-label={`Silhueta — ${vista}`}>
          <image href={imgDaVista(vista)} x={0} y={0} width={IMG_W} height={IMG_H} preserveAspectRatio="xMidYMid meet" />
          {marcasDaVista(vista).map((m) => {
            const on = has(m.parte);
            return (
              <g key={m.parte} onClick={() => toggle(m.parte)} style={{ cursor: ro ? "default" : "pointer" }}>
                <title>{m.parte}</title>
                <circle cx={m.cx} cy={m.cy} r={MARK.r2} fill="transparent" />
                {on ? (
                  <>
                    <circle cx={m.cx} cy={m.cy} r={MARK.r2} fill="none" stroke={COR_SEL} strokeWidth={2} opacity={0.4} />
                    <circle cx={m.cx} cy={m.cy} r={MARK.r1} fill="none" stroke={COR_SEL} strokeWidth={2.6} opacity={0.85} />
                    <circle cx={m.cx} cy={m.cy} r={MARK.r0} fill={COR_SEL} />
                  </>
                ) : (
                  !ro && <circle cx={m.cx} cy={m.cy} r={6} fill={COR_SEL} opacity={0.28} />
                )}
              </g>
            );
          })}
        </svg>
        <p className="text-center text-[10px] text-gray-400">lados na perspectiva do acidentado</p>
      </div>

      <div className="flex-1">
        <div className="flex flex-wrap gap-1.5">
          {PARTES.map((p) => {
            const on = has(p);
            return (
              <button
                key={p}
                type="button"
                disabled={ro}
                onClick={() => toggle(p)}
                className={[
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition",
                  on ? "border-red-300 bg-red-50 text-red-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                ].join(" ")}
              >
                {p}
              </button>
            );
          })}
        </div>
        {value.length > 0 && (
          <p className="mt-2 text-xs text-gray-400">{value.length} parte(s) selecionada(s).</p>
        )}
      </div>
    </div>
  );
}
