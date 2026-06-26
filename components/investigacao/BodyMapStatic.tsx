import React from "react";
import { marcasDaVista, VIEWBOX, IMG_W, IMG_H, MARK, COR_SEL } from "@/lib/investigacao/corpo";

/** Silhueta (frente + costas) com as marcas vermelhas das partes selecionadas.
 *  `imgFrente`/`imgCostas` devem ser URLs absolutas ou data URIs (o Puppeteer
 *  não resolve caminho relativo). Pura — usável no laudo via renderToStaticMarkup. */
export default function BodyMapStatic({
  value,
  imgFrente,
  imgCostas,
}: {
  value: string[];
  imgFrente: string;
  imgCostas: string;
}) {
  const w = 130;
  const h = Math.round((w * IMG_H) / IMG_W);
  const fig = (v: "frente" | "costas", img: string) => {
    const marcas = marcasDaVista(v).filter((m) => value.includes(m.parte));
    return (
      <div style={{ textAlign: "center" }}>
        <svg viewBox={VIEWBOX} width={w} height={h} role="img" aria-label={`Silhueta ${v}`}>
          <image href={img} x={0} y={0} width={IMG_W} height={IMG_H} preserveAspectRatio="xMidYMid meet" />
          {marcas.map((m) => (
            <g key={m.parte}>
              <circle cx={m.cx} cy={m.cy} r={MARK.r2} fill="none" stroke={COR_SEL} strokeWidth={2} opacity={0.4} />
              <circle cx={m.cx} cy={m.cy} r={MARK.r1} fill="none" stroke={COR_SEL} strokeWidth={2.6} opacity={0.85} />
              <circle cx={m.cx} cy={m.cy} r={MARK.r0} fill={COR_SEL} />
            </g>
          ))}
        </svg>
        <div style={{ fontSize: 8, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".06em" }}>{v}</div>
      </div>
    );
  };
  return (
    <div style={{ display: "flex", gap: 18 }}>
      {fig("frente", imgFrente)}
      {fig("costas", imgCostas)}
    </div>
  );
}
