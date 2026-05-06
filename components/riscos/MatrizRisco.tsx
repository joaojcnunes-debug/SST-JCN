"use client";

import { calcularNivelRisco, PROBABILIDADES, SEVERIDADES } from "@/lib/utils";
import { NIVEL_CONFIG } from "@/lib/constants";

export default function MatrizRisco() {
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
                    style={{
                      backgroundColor: cfg.bg,
                      color: cfg.cor,
                      border: `1px solid ${cfg.borda}`,
                    }}
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
