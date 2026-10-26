"use client";

import { useRouter } from "next/navigation";

export type FontePessoa = "inspecoes" | "documentos" | "associados";

/** Endereço da página da pessoa (/dashboard/pessoa) para cada gráfico de origem. */
export function linkPessoa(fonte: FontePessoa, nome: string): string {
  return `/dashboard/pessoa?fonte=${fonte}&nome=${encodeURIComponent(nome)}`;
}

/**
 * Rótulo do eixo Y dos gráficos "por pessoa": o nome vira link para a página com as empresas em que
 * a pessoa atuou, no recorte do gráfico de origem (pedido de 26/10/2026).
 */
export default function TickPessoa({
  x,
  y,
  payload,
  fonte,
  naoClicaveis = [],
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
  fonte: FontePessoa;
  naoClicaveis?: readonly string[];
}) {
  const router = useRouter();
  const nome = payload?.value ?? "";
  const clicavel = !!nome && !naoClicaveis.includes(nome);
  return (
    <g transform={`translate(${x ?? 0},${y ?? 0})`}>
      <text
        x={-4}
        y={0}
        dy={4}
        textAnchor="end"
        fontSize={11}
        fill={clicavel ? "#0284c7" : "var(--text-body)"}
        style={{ cursor: clicavel ? "pointer" : "default", textDecoration: clicavel ? "underline" : "none" }}
        onClick={() => clicavel && router.push(linkPessoa(fonte, nome))}
      >
        <title>{clicavel ? `Ver as empresas de ${nome}` : nome}</title>
        {nome.length > 24 ? `${nome.slice(0, 23)}…` : nome}
      </text>
    </g>
  );
}
