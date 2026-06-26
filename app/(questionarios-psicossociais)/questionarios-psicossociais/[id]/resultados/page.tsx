"use client";

import { use, useMemo, useState } from "react";
import { BarChart2, ChevronLeft, Loader2, Info, Building2, Save } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  useQpsAplicacao,
  useQpsRespondentes,
  useQpsCategorias,
  useQpsAllPerguntas,
  useQpsProbabilidades,
  useUpsertQpsProbabilidade,
  useUpdateQpsAplicacao,
} from "@/lib/hooks/useQuestionarios";
import { useQpsTipos } from "@/lib/hooks/useQuestionarios";
import type { QpsCategoria, QpsPergunta, QpsProbabilidade } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

// ─── Constantes de risco ──────────────────────────────────────────────────────

const PROB_LABEL = ["", "Baixa", "Média", "Alta"] as const;
const SEVERIDADE = 3; // fixo para risco psicossocial (NR-01)

type NivelRisco = "BAIXO" | "MODERADO" | "ALTO";

function nivelRisco(prob: 1 | 2 | 3): NivelRisco {
  const score = prob * SEVERIDADE;
  if (score <= 3) return "BAIXO";
  if (score <= 6) return "MODERADO";
  return "ALTO";
}

const RISCO_COR: Record<NivelRisco, string> = {
  BAIXO: "bg-green-100 text-green-800 border-green-200",
  MODERADO: "bg-yellow-100 text-yellow-800 border-yellow-200",
  ALTO: "bg-red-100 text-red-800 border-red-200",
};

const RISCO_PONTO: Record<NivelRisco, string> = {
  BAIXO: "bg-green-500",
  MODERADO: "bg-yellow-400",
  ALTO: "bg-red-500",
};

// ─── Cálculo de score ─────────────────────────────────────────────────────────

function normalizarResposta(
  valor: number,
  logica: "direta" | "invertida",
  min: number,
  max: number
): number {
  const v = logica === "invertida" ? max + min - valor : valor;
  return ((v - min) / (max - min)) * 100;
}

function scoreToProbabilidade(score: number): 1 | 2 | 3 {
  if (score < 34) return 1;
  if (score < 67) return 2;
  return 3;
}

interface CelulaMatriz {
  setor: string;
  categoria: QpsCategoria;
  scorePerc: number;
  probCalculada: 1 | 2 | 3;
  probEfetiva: 1 | 2 | 3;
  override: boolean;
  risco: NivelRisco;
  nRespondentes: number;
}

function calcularMatriz(
  setores: string[],
  categorias: QpsCategoria[],
  perguntas: QpsPergunta[],
  respondentes: { setor: string; respostas: Record<string, number> }[],
  overrides: QpsProbabilidade[],
  escalaMin: number,
  escalaMax: number
): CelulaMatriz[] {
  const overrideMap = new Map(
    overrides.map((o) => [`${o.setor}|${o.id_categoria}`, o.probabilidade as 1 | 2 | 3])
  );

  const cells: CelulaMatriz[] = [];

  for (const setor of setores) {
    const resp = respondentes.filter((r) => r.setor === setor);

    for (const cat of categorias) {
      const pergsCat = perguntas.filter((p) => p.id_categoria === cat.id_categoria);
      const scores: number[] = [];

      for (const r of resp) {
        for (const p of pergsCat) {
          const val = r.respostas[p.id_pergunta];
          if (val === undefined || val === null) continue;
          scores.push(normalizarResposta(val, p.logica, escalaMin, escalaMax));
        }
      }

      const scorePerc =
        scores.length > 0
          ? scores.reduce((a, b) => a + b, 0) / scores.length
          : 0;

      const probCalculada = scores.length > 0 ? scoreToProbabilidade(scorePerc) : 1;
      const chave = `${setor}|${cat.id_categoria}`;
      const probOverride = overrideMap.get(chave);
      const probEfetiva = probOverride ?? probCalculada;

      cells.push({
        setor,
        categoria: cat,
        scorePerc: Math.round(scorePerc),
        probCalculada,
        probEfetiva,
        override: !!probOverride,
        risco: nivelRisco(probEfetiva),
        nRespondentes: resp.length,
      });
    }
  }

  return cells;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ResultadosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [celulaEditando, setCelulaEditando] = useState<string | null>(null);
  const [obsLocal, setObsLocal] = useState<Record<string, string>>({});
  const [obsInicializado, setObsInicializado] = useState(false);

  const { data: ap } = useQpsAplicacao(id);
  const { data: tipos = [] } = useQpsTipos();
  const { data: categorias = [] } = useQpsCategorias(ap?.id_tipo ?? null);
  const { data: todasPerguntas = [] } = useQpsAllPerguntas(ap?.id_tipo ?? null);
  const { data: respondentes = [], isLoading: loadingResp } = useQpsRespondentes(id);
  const { data: probabilidades = [] } = useQpsProbabilidades(id);
  const upsertProb = useUpsertQpsProbabilidade();
  const updateAp = useUpdateQpsAplicacao();

  const tipo = tipos.find((t) => t.id_tipo === ap?.id_tipo);

  // Inicializa obsLocal com dados já salvos no banco (roda só uma vez quando ap carrega)
  if (ap && !obsInicializado) {
    setObsInicializado(true);
    if (ap.observacoes_dimensoes) setObsLocal(ap.observacoes_dimensoes);
  }

  async function salvarObservacoes() {
    if (!ap) return;
    try {
      await updateAp.mutateAsync({
        id: ap.id_aplicacao,
        idEmpresa: ap.id_empresa,
        input: { observacoes_dimensoes: obsLocal },
      });
      toast.success("Análise salva");
    } catch {
      toast.error("Erro ao salvar análise");
    }
  }

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

  async function handleOverride(
    setor: string,
    idCategoria: string,
    idAplicacao: string,
    prob: 1 | 2 | 3
  ) {
    try {
      await upsertProb.mutateAsync({
        id_aplicacao: idAplicacao,
        setor,
        id_categoria: idCategoria,
        probabilidade: prob,
        atualizado_em: new Date().toISOString(),
      });
      toast.success("Probabilidade ajustada");
      setCelulaEditando(null);
    } catch {
      toast.error("Erro ao salvar ajuste");
    }
  }

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
              34–66% = Média, 67–100% = Alta). Severidade fixada em 3 (NR-01). Clique em uma célula
              para ajustar manualmente a probabilidade.
            </span>
          </div>

          {/* Matriz */}
          <MatrizRisco
            setores={setores}
            categorias={categorias}
            matriz={matriz}
            idAplicacao={id}
            celulaEditando={celulaEditando}
            onSelectCelula={setCelulaEditando}
            onOverride={handleOverride}
            salvando={upsertProb.isPending}
          />

          {/* Análise qualitativa por dimensão — NR-1 / Fundacentro 2026 */}
          {(() => {
            const dimensoesCriticas = categorias.filter((cat) =>
              matriz.some(
                (c) =>
                  c.categoria.id_categoria === cat.id_categoria &&
                  (c.risco === "MODERADO" || c.risco === "ALTO")
              )
            );
            if (dimensoesCriticas.length === 0) return null;
            return (
              <div className="rounded-xl border border-indigo-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-indigo-100 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="size-4 text-indigo-600" />
                    <h2 className="text-sm font-bold text-gray-900">
                      Análise das Dimensões Críticas
                    </h2>
                  </div>
                  <button
                    onClick={salvarObservacoes}
                    disabled={updateAp.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {updateAp.isPending
                      ? <Loader2 className="size-3.5 animate-spin" />
                      : <Save className="size-3.5" />}
                    Salvar análise
                  </button>
                </div>
                <div className="px-5 py-3 text-xs text-indigo-700 bg-indigo-50 border-b border-indigo-100">
                  Para cada dimensão com risco Moderado ou Alto, descreva quais
                  <strong> condições de trabalho, práticas de gestão ou fatores organizacionais</strong> observados
                  explicam o resultado. Foque nas condições — não em características individuais.
                </div>
                <div className="divide-y divide-gray-100">
                  {dimensoesCriticas.map((cat) => {
                    const celulas = matriz.filter(
                      (c) => c.categoria.id_categoria === cat.id_categoria
                    );
                    const temAlto = celulas.some((c) => c.risco === "ALTO");
                    return (
                      <div key={cat.id_categoria} className="px-5 py-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-bold",
                              temAlto
                                ? "bg-red-100 text-red-700"
                                : "bg-yellow-100 text-yellow-700"
                            )}
                          >
                            {temAlto ? "ALTO" : "MODERADO"}
                          </span>
                          <span className="text-sm font-semibold text-gray-800">
                            {cat.nome}
                          </span>
                        </div>
                        <textarea
                          rows={3}
                          value={obsLocal[cat.id_categoria] ?? ""}
                          onChange={(e) =>
                            setObsLocal((prev) => ({
                              ...prev,
                              [cat.id_categoria]: e.target.value,
                            }))
                          }
                          placeholder={`O que na organização do trabalho explica o resultado desta dimensão? Ex: metas agressivas sem participação dos trabalhadores na definição, jornadas prolongadas por déficit de equipe, falta de autonomia nas decisões operacionais…`}
                          className="w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm leading-relaxed focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
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
  idAplicacao,
  celulaEditando,
  onSelectCelula,
  onOverride,
  salvando,
}: {
  setores: string[];
  categorias: QpsCategoria[];
  matriz: CelulaMatriz[];
  idAplicacao: string;
  celulaEditando: string | null;
  onSelectCelula: (key: string | null) => void;
  onOverride: (setor: string, idCategoria: string, idAplicacao: string, prob: 1 | 2 | 3) => void;
  salvando: boolean;
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
                const chave = `${setor}|${cat.id_categoria}`;
                const editando = celulaEditando === chave;
                if (!c) return <td key={setor} className="px-3 py-3 text-center text-gray-300">—</td>;

                return (
                  <td key={setor} className="px-3 py-2 text-center">
                    {editando ? (
                      <div className="flex flex-col items-center gap-1">
                        <p className="text-[10px] font-semibold text-gray-500 mb-1">Ajustar:</p>
                        <div className="flex gap-1">
                          {([1, 2, 3] as const).map((p) => (
                            <button
                              key={p}
                              onClick={() => onOverride(setor, cat.id_categoria, idAplicacao, p)}
                              disabled={salvando}
                              className={cn(
                                "rounded px-2 py-0.5 text-xs font-bold border",
                                p === 1 && "border-green-300 bg-green-50 text-green-700 hover:bg-green-100",
                                p === 2 && "border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100",
                                p === 3 && "border-red-300 bg-red-50 text-red-700 hover:bg-red-100",
                                c.probEfetiva === p && "ring-2 ring-offset-1",
                                p === 1 && c.probEfetiva === p && "ring-green-500",
                                p === 2 && c.probEfetiva === p && "ring-yellow-500",
                                p === 3 && c.probEfetiva === p && "ring-red-500"
                              )}
                            >
                              {PROB_LABEL[p]}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => onSelectCelula(null)}
                          className="mt-1 text-[10px] text-gray-400 hover:text-gray-600"
                        >
                          Fechar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => onSelectCelula(chave)}
                        className={cn(
                          "inline-flex flex-col items-center gap-0.5 rounded-lg border px-3 py-2 w-full transition-all hover:shadow-sm",
                          RISCO_COR[c.risco]
                        )}
                        title={`${c.scorePerc}% · ${c.nRespondentes} respondentes · Clique para ajustar`}
                      >
                        <span className="flex items-center gap-1 text-xs font-bold">
                          <span className={cn("size-2 rounded-full", RISCO_PONTO[c.risco])} />
                          {PROB_LABEL[c.probEfetiva]}
                        </span>
                        <span className="text-[10px] opacity-70">{c.scorePerc}%</span>
                        {c.override && (
                          <span className="text-[9px] font-semibold opacity-60">ajustado</span>
                        )}
                      </button>
                    )}
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
        <span className="ml-auto italic">Clique em qualquer célula para ajustar a probabilidade</span>
      </div>
    </div>
  );
}
