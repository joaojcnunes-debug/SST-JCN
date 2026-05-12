"use client";

import { calcularMatriz, CORES_MATRIZ } from "@/lib/drps/calculos";
import type { NivelMatriz, TopicoComMatriz } from "@/lib/drps/types";

/**
 * Heatmap 3×3 (Gravidade × Probabilidade) com os tópicos posicionados na
 * célula correspondente, conforme spec do DRPS.
 */
export default function MatrizRisco({
  topicos,
}: {
  topicos: TopicoComMatriz[];
}) {
  // Preencho a matriz: linha = gravidade (3-1 top→bottom), col = probabilidade (1-3)
  const linhas: NivelMatriz[][] = [];
  const conteudo: TopicoComMatriz[][][] = [];
  for (let g = 3; g >= 1; g--) {
    const linhaCores: NivelMatriz[] = [];
    const linhaConteudo: TopicoComMatriz[][] = [];
    for (let p = 1; p <= 3; p++) {
      linhaCores.push(calcularMatriz(g as 1 | 2 | 3, p as 1 | 2 | 3));
      linhaConteudo.push(
        topicos.filter(
          (t) => t.classificacaoGravidade.num === g && t.probabilidade === p
        )
      );
    }
    linhas.push(linhaCores);
    conteudo.push(linhaConteudo);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            <th className="w-24 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              Gravidade ↓ / Probabilidade →
            </th>
            <th className="text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
              Baixa (1)
            </th>
            <th className="text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
              Média (2)
            </th>
            <th className="text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
              Alta (3)
            </th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, i) => {
            const gravidadeLabel = i === 0 ? "Alta (3)" : i === 1 ? "Média (2)" : "Baixa (1)";
            return (
              <tr key={i}>
                <td className="py-1 pr-2 text-xs font-semibold text-gray-700">
                  {gravidadeLabel}
                </td>
                {linha.map((nivel, j) => {
                  const cell = conteudo[i][j];
                  return (
                    <td key={j} className="p-1 align-top">
                      <div
                        className="min-h-[90px] rounded-md p-2 text-xs text-white shadow-sm"
                        style={{ backgroundColor: CORES_MATRIZ[nivel] }}
                      >
                        <p className="mb-1 font-bold uppercase tracking-wider">
                          {nivel}
                        </p>
                        <ul className="space-y-0.5">
                          {cell.map((t) => (
                            <li
                              key={t.idx}
                              className="truncate"
                              title={t.nome}
                            >
                              • {t.nome}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
