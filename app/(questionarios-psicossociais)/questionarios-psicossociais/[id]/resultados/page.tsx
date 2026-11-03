"use client";

import { use, useMemo } from "react";
import { BarChart2, ChevronLeft, Loader2, Info } from "lucide-react";
import Link from "next/link";
import {
  useQpsAplicacao,
  useQpsRespondentes,
  useQpsCategorias,
  useQpsAllPerguntas,
  useQpsProbabilidades,
} from "@/lib/hooks/useQuestionarios";
import { useQpsTipos } from "@/lib/hooks/useQuestionarios";
import type { QpsCategoria } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
// A conta da matriz mora em lib/qps/matriz.ts desde 10/08, para a tela de
// Resumo usar exatamente a mesma régua. Nada da fórmula mudou na mudança.
import {
  PROB_LABEL,
  RISCO_COR,
  RISCO_PONTO,
  calcularMatriz,
  type CelulaMatriz,
  type NivelRisco,
} from "@/lib/qps/matriz";

// 03/11/2026 (0.3.218): esta tela passou a SÓ MOSTRAR. O clique numa célula gravava a
// probabilidade em `qps_probabilidades` — a mesma tabela que a Análise e o laudo usam —, apesar
// de a Análise dizer o contrário; e a "Análise das Dimensões Críticas" gravava um texto que nada
// lia. O ajuste da probabilidade fica só na Análise; o texto técnico, na Conclusão de lá.

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ResultadosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: ap } = useQpsAplicacao(id);
  const { data: tipos = [] } = useQpsTipos();
  const { data: categorias = [] } = useQpsCategorias(ap?.id_tipo ?? null);
  const { data: todasPerguntas = [] } = useQpsAllPerguntas(ap?.id_tipo ?? null);
  const { data: respondentes = [], isLoading: loadingResp } = useQpsRespondentes(id);
  const { data: probabilidades = [] } = useQpsProbabilidades(id);

  const tipo = tipos.find((t) => t.id_tipo === ap?.id_tipo);

  const setores = useMemo(
    () => [...new Set(respondentes.map((r) => r.setor))].sort(),
    [respondentes]
  );

  const matriz = useMemo(() => {
    if (!tipo || setores.length === 0 || categorias.length === 0) return [];
    return calcularMatriz(
      setores,
      categorias,
      todasPerguntas,
      respondentes,
      probabilidades,
      tipo.escala_min,
      tipo.escala_max
    );
  }, [tipo, setores, categorias, todasPerguntas, respondentes, probabilidades]);

  // Resumo de risco (contagem por nível)
  const resumo = useMemo(() => {
    const r = { BAIXO: 0, MODERADO: 0, ALTO: 0 };
    for (const c of matriz) r[c.risco]++;
    return r;
  }, [matriz]);

  const semDados = respondentes.length === 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/questionarios-psicossociais/${id}`}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="size-4" /> Voltar
        </Link>
      </div>

      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <BarChart2 className="size-5 text-indigo-600" /> Resultados / Matriz de Risco
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {ap?.titulo} · {respondentes.length} respondente{respondentes.length !== 1 ? "s" : ""} · {setores.length} setor{setores.length !== 1 ? "es" : ""}
        </p>
      </div>

      {loadingResp ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
          <Loader2 className="size-4 animate-spin" /> Calculando...
        </div>
      ) : semDados ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-16 text-center text-sm text-gray-400">
          Nenhum respondente cadastrado.{" "}
          <Link
            href={`/questionarios-psicossociais/${id}/respondentes`}
            className="text-indigo-600 underline"
          >
            Adicione respondentes
          </Link>{" "}
          para ver os resultados.
        </div>
      ) : (
        <>
          {/* Resumo geral */}
          <div className="grid grid-cols-3 gap-4">
            {(["BAIXO", "MODERADO", "ALTO"] as NivelRisco[]).map((nivel) => (
              <div
                key={nivel}
                className={cn(
                  "rounded-xl border p-4 text-center",
                  RISCO_COR[nivel]
                )}
              >
                <p className="text-2xl font-bold">{resumo[nivel]}</p>
                <p className="mt-0.5 text-xs font-semibold">
                  {nivel.charAt(0) + nivel.slice(1).toLowerCase()}
                </p>
              </div>
            ))}
          </div>

          {/* Nota metodológica */}
          <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>
              Probabilidade calculada automaticamente a partir das médias normalizadas (0–33% = Baixa,
              34–66% = Média, 67–100% = Alta). Severidade fixada em 3 (NR-01). Para ajustar a
              probabilidade, use a{" "}
              <Link href={`/questionarios-psicossociais/${id}/analise`} className="font-semibold underline">
                Análise
              </Link>
              {" "}— é ela que vale no laudo.
            </span>
          </div>

          {/* Matriz */}
          <MatrizRisco setores={setores} categorias={categorias} matriz={matriz} />
        </>
      )}
    </div>
  );
}

// ─── Componente da matriz ─────────────────────────────────────────────────────

function MatrizRisco({
  setores,
  categorias,
  matriz,
}: {
  setores: string[];
  categorias: QpsCategoria[];
  matriz: CelulaMatriz[];
}) {
  function celula(setor: string, cat: QpsCategoria) {
    return matriz.find((c) => c.setor === setor && c.categoria.id_categoria === cat.id_categoria);
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-48">
              Dimensão / Setor
            </th>
            {setores.map((s) => (
              <th
                key={s}
                className="px-3 py-3 text-center text-xs font-semibold text-gray-700 min-w-[110px]"
              >
                {s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {categorias.map((cat) => (
            <tr key={cat.id_categoria} className="hover:bg-gray-50/50">
              <td className="px-4 py-3 font-medium text-gray-800 text-xs">{cat.nome}</td>
              {setores.map((setor) => {
                const c = celula(setor, cat);
                if (!c) return <td key={setor} className="px-3 py-3 text-center text-gray-300">—</td>;
                return (
                  <td key={setor} className="px-3 py-2 text-center">
                    <div
                      className={cn(
                        "inline-flex w-full flex-col items-center gap-0.5 rounded-lg border px-3 py-2",
                        RISCO_COR[c.risco]
                      )}
                      title={`${c.scorePerc}% · ${c.nRespondentes} respondentes`}
                    >
                      <span className="flex items-center gap-1 text-xs font-bold">
                        <span className={cn("size-2 rounded-full", RISCO_PONTO[c.risco])} />
                        {PROB_LABEL[c.probEfetiva]}
                      </span>
                      <span className="text-[10px] opacity-70">{c.scorePerc}%</span>
                      {c.override && (
                        <span className="text-[9px] font-semibold opacity-60">ajustado na Análise</span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
        {(["BAIXO", "MODERADO", "ALTO"] as NivelRisco[]).map((n) => (
          <span key={n} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full", RISCO_PONTO[n])} />
            {n.charAt(0) + n.slice(1).toLowerCase()} (P × S = {
              n === "BAIXO" ? "1–3" : n === "MODERADO" ? "4–6" : "7–9"
            })
          </span>
        ))}
      </div>
    </div>
  );
}
