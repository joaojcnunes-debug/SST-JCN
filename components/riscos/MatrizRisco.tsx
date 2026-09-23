"use client";

import { calcularNivelRisco, PROBABILIDADES, SEVERIDADES } from "@/lib/utils";
import { NIVEL_CONFIG } from "@/lib/constants";
import { useTema } from "@/lib/store";

export default function MatrizRisco() {
  const escuro = useTema((s) => s.tema) === "dark";

  // Os pastéis de NIVEL_CONFIG (#dcfce7, #fef3c7…) são inline, então o shim do
  // globals.css não os alcança: no escuro virariam blocos claros. Reancoro a
  // célula na cor FORTE do nível misturada com a superfície do tema — mesma
  // receita do shim. NIVEL_CONFIG em si não muda: é lido pelos badges e pelo
  // laudo, que continuam claros.
  const celula = (cfg: (typeof NIVEL_CONFIG)[keyof typeof NIVEL_CONFIG]) =>
    escuro
      ? {
          backgroundColor: `color-mix(in srgb, ${cfg.cor} 22%, var(--surface))`,
          color: `color-mix(in srgb, ${cfg.cor} 62%, var(--text-strong))`,
          border: `1px solid color-mix(in srgb, ${cfg.cor} 40%, var(--surface))`,
        }
      : {
          backgroundColor: cfg.bg,
          color: cfg.cor,
          border: `1px solid ${cfg.borda}`,
        };

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th className="bg-gray-100 p-2 font-semibold text-gray-500">
              Severidade ↓ / Probabilidade →
            </th>
            {PROBABILIDADES.map((p) => (
              <th
                key={p}
                className="bg-gray-100 p-2 font-medium text-gray-700"
                style={{ minWidth: 110 }}
              >
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SEVERIDADES.map((s) => (
            <tr key={s}>
              <th className="bg-gray-100 p-2 text-left font-medium text-gray-700">
                {s}
              </th>
              {PROBABILIDADES.map((p) => {
                const nivel = calcularNivelRisco(p, s);
                const cfg = NIVEL_CONFIG[nivel];
                return (
                  <td
                    key={p + s}
                    className="rounded p-2 text-center font-semibold"
                    style={celula(cfg)}
                  >
                    {nivel}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
