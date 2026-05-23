"use client";

import { use, useState, useEffect } from "react";
import { Brain, ChevronDown, ChevronUp, Loader2, Save } from "lucide-react";
import toast from "react-hot-toast";
import {
  useAetRelatorio,
  useAet13FatoresConfig,
  useAet13FatoresPerguntas,
  useAet13FatoresSemaforo,
  useAetLaudoQpsMeta,
  useAetSalvarQpsMeta,
  useAetLaudoFatoresPsi,
  useAetSalvarFatorPsi,
  useAetQpsRespostas,
  useAetSalvarQpsResposta,
  zonaFromMedia,
  nivelPgrFromZona,
  SEMAFORO_DEFAULT,
} from "@/lib/hooks/useAet";
import { cn } from "@/lib/utils";
import type { Aet13FatorPergunta, AetLaudoQpsMeta, AetLaudoQpsResposta, ZonaPsi } from "@/lib/supabase/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const FORMAS_COLETA = [
  "Presencial — papel",
  "Presencial — tablet/digital",
  "Híbrido (parte presencial, parte digital)",
];

const ESCALA = [1, 2, 3, 4, 5] as const;
const ESCALA_LABEL: Record<number, string> = {
  1: "Nunca",
  2: "Raramente",
  3: "Às vezes",
  4: "Frequentemente",
  5: "Sempre",
};

const ZONA_LABEL: Record<ZonaPsi, string> = {
  verde: "Verde — Satisfatório",
  amarela: "Amarela — Atenção",
  laranja: "Laranja — Elevado",
  vermelha: "Vermelha — Crítico",
};

const ZONA_CLASS: Record<ZonaPsi, string> = {
  verde: "bg-green-100 text-green-800 border-green-300",
  amarela: "bg-yellow-100 text-yellow-800 border-yellow-300",
  laranja: "bg-orange-100 text-orange-800 border-orange-300",
  vermelha: "bg-red-100 text-red-800 border-red-300",
};

const ZONA_DOT: Record<ZonaPsi, string> = {
  verde: "bg-green-500",
  amarela: "bg-yellow-400",
  laranja: "bg-orange-500",
  vermelha: "bg-red-600",
};

const ZONA_BORDER_L: Record<ZonaPsi, string> = {
  verde: "#22c55e",
  amarela: "#eab308",
  laranja: "#f97316",
  vermelha: "#ef4444",
};

// ─── Calculation helper ───────────────────────────────────────────────────────

function calcularMediaFator(
  perguntas: Aet13FatorPergunta[],
  respostasSetor: AetLaudoQpsResposta[],
  codigoFator: string
): number | null {
  const pFator = perguntas.filter((p) => p.codigo_fator === codigoFator);
  if (pFator.length === 0) return null;
  const scores: number[] = [];
  for (const p of pFator) {
    const r = respostasSetor.find(
      (res) => res.codigo_fator === codigoFator && res.pergunta_ordem === p.ordem
    );
    if (r == null) continue;
    scores.push(p.logica === "direta" ? 6 - r.resposta : r.resposta);
  }
  if (scores.length === 0) return null;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PsicossocialPage({
  params,
}: {
  params: Promise<{ idRelatorio: string }>;
}) {
  const { idRelatorio } = use(params);

  const { data: rel, isLoading: loadingRel } = useAetRelatorio(idRelatorio);
  const { data: fatores = [], isLoading: loadingFatores } = useAet13FatoresConfig();
  const { data: perguntas = [] } = useAet13FatoresPerguntas();
  const { data: semaforo = SEMAFORO_DEFAULT } = useAet13FatoresSemaforo();
  const { data: qpsMeta, isLoading: loadingMeta } = useAetLaudoQpsMeta(idRelatorio);
  const { data: fatoresPsi = [] } = useAetLaudoFatoresPsi(idRelatorio);
  const { data: todasRespostas = [] } = useAetQpsRespostas(idRelatorio);

  const salvarMeta = useAetSalvarQpsMeta();
  const salvarFator = useAetSalvarFatorPsi();
  const salvarResposta = useAetSalvarQpsResposta();

  // ─── State ────────────────────────────────────────────────────────────────

  const [setorAtivo, setSetorAtivo] = useState<string | null>(null);
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [observacoes, setObservacoes] = useState<Record<string, string>>({});
  const [perguntasCriticas, setPerguntasCriticas] = useState<Record<string, string>>({});
  const [zonasManuais, setZonasManuais] = useState<Record<string, ZonaPsi | null>>({});
  const [salvandoFator, setSalvandoFator] = useState<string | null>(null);

  const [meta, setMeta] = useState<Omit<AetLaudoQpsMeta, "updated_at">>({
    id_relatorio: idRelatorio,
    n_respondentes: null,
    total_elegivel: null,
    periodo_inicio: null,
    periodo_fim: null,
    modo_aplicacao: null,
    tecnico_aplicador: null,
    observacao_geral: null,
  });

  useEffect(() => {
    if (rel?.setores.length && !setorAtivo) {
      setSetorAtivo(rel.setores[0].id);
    }
  }, [rel, setorAtivo]);

  useEffect(() => {
    if (qpsMeta) {
      setMeta({
        id_relatorio: idRelatorio,
        n_respondentes: qpsMeta.n_respondentes,
        total_elegivel: qpsMeta.total_elegivel,
        periodo_inicio: qpsMeta.periodo_inicio,
        periodo_fim: qpsMeta.periodo_fim,
        modo_aplicacao: qpsMeta.modo_aplicacao,
        tecnico_aplicador: qpsMeta.tecnico_aplicador,
        observacao_geral: qpsMeta.observacao_geral,
      });
    }
  }, [qpsMeta, idRelatorio]);

  useEffect(() => {
    const obs: Record<string, string> = {};
    const pc: Record<string, string> = {};
    const zm: Record<string, ZonaPsi | null> = {};
    for (const fp of fatoresPsi) {
      obs[fp.codigo_fator] = fp.observacao ?? "";
      pc[fp.codigo_fator] = fp.pergunta_critica ?? "";
      if (fp.codigo_fator === "F13") zm[fp.codigo_fator] = fp.zona ?? null;
    }
    setObservacoes(obs);
    setPerguntasCriticas(pc);
    setZonasManuais(zm);
  }, [fatoresPsi]);

  // ─── Derived ──────────────────────────────────────────────────────────────

  const adesaoPct =
    meta.n_respondentes && meta.total_elegivel && meta.total_elegivel > 0
      ? Math.round((meta.n_respondentes / meta.total_elegivel) * 100)
      : null;

  const setores = rel?.setores ?? [];
  const setorAtivoObj = setores.find((s) => s.id === setorAtivo);
  const respostasSetor = todasRespostas.filter((r) => r.id_setor === setorAtivo);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  async function handleSalvarMeta() {
    try {
      await salvarMeta.mutateAsync(meta);
    } catch {
      // handled in hook
    }
  }

  async function handleResposta(codigoFator: string, perguntaOrdem: number, value: number) {
    if (!setorAtivo) return;
    try {
      await salvarResposta.mutateAsync({
        id_relatorio: idRelatorio,
        id_setor: setorAtivo,
        codigo_fator: codigoFator,
        pergunta_ordem: perguntaOrdem,
        resposta: value,
      });
    } catch {
      // handled in hook
    }
  }

  async function handleSalvarFator(codigoFator: string) {
    const isF13 = codigoFator === "F13";
    const mediaCalc = isF13
      ? null
      : calcularMediaFator(perguntas, respostasSetor, codigoFator);
    const zona = isF13
      ? (zonasManuais[codigoFator] ?? null)
      : zonaFromMedia(mediaCalc);

    setSalvandoFator(codigoFator);
    try {
      await salvarFator.mutateAsync({
        id_relatorio: idRelatorio,
        codigo_fator: codigoFator,
        avaliado: true,
        media: mediaCalc,
        pct_zona_risco: null,
        pergunta_critica: perguntasCriticas[codigoFator] || null,
        observacao: observacoes[codigoFator] || null,
        zona,
      });
      toast.success(`Fator ${codigoFator} salvo`);
    } catch {
      // handled in hook
    } finally {
      setSalvandoFator(null);
    }
  }

  function toggleAberto(codigo: string) {
    setAbertos((prev) => ({ ...prev, [codigo]: !prev[codigo] }));
  }

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loadingRel || loadingFatores || loadingMeta) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-4xl space-y-8">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="flex size-10 items-center justify-center rounded-xl"
          style={{ background: "#006B54" }}
        >
          <Brain className="size-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">13 Fatores Psicossociais</h1>
          <p className="text-sm text-gray-500">
            {rel?.empresas && "nome_empresa" in (rel.empresas as object)
              ? (rel.empresas as { nome_empresa: string }).nome_empresa
              : ""}
          </p>
        </div>
      </div>

      {/* ─── B1: Dados da Aplicação ──────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Dados da Aplicação QPS
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">N.º de Respondentes</label>
            <input
              type="number" min={0}
              value={meta.n_respondentes ?? ""}
              onChange={(e) => setMeta((m) => ({ ...m, n_respondentes: e.target.value ? Number(e.target.value) : null }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
              placeholder="ex: 42"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Total Elegível</label>
            <input
              type="number" min={0}
              value={meta.total_elegivel ?? ""}
              onChange={(e) => setMeta((m) => ({ ...m, total_elegivel: e.target.value ? Number(e.target.value) : null }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
              placeholder="ex: 50"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">% Adesão</label>
            <div className={cn(
              "flex h-[38px] items-center rounded-lg border px-3 text-sm font-semibold",
              adesaoPct !== null
                ? adesaoPct >= 70
                  ? "border-green-300 bg-green-50 text-green-700"
                  : "border-yellow-300 bg-yellow-50 text-yellow-700"
                : "border-gray-200 bg-gray-50 text-gray-400"
            )}>
              {adesaoPct !== null ? `${adesaoPct}%` : "—"}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Período — Início</label>
            <input
              type="date"
              value={meta.periodo_inicio ?? ""}
              onChange={(e) => setMeta((m) => ({ ...m, periodo_inicio: e.target.value || null }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Período — Fim</label>
            <input
              type="date"
              value={meta.periodo_fim ?? ""}
              onChange={(e) => setMeta((m) => ({ ...m, periodo_fim: e.target.value || null }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Forma de Coleta</label>
            <select
              value={meta.modo_aplicacao ?? ""}
              onChange={(e) => setMeta((m) => ({ ...m, modo_aplicacao: e.target.value || null }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
            >
              <option value="">Selecione…</option>
              {FORMAS_COLETA.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <label className="mb-1 block text-xs font-medium text-gray-600">Técnico Aplicador</label>
            <input
              type="text"
              value={meta.tecnico_aplicador ?? ""}
              onChange={(e) => setMeta((m) => ({ ...m, tecnico_aplicador: e.target.value || null }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
              placeholder="Nome do técnico ou engenheiro que conduziu a aplicação"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-gray-600">Observação Geral</label>
          <textarea
            rows={2}
            value={meta.observacao_geral ?? ""}
            onChange={(e) => setMeta((m) => ({ ...m, observacao_geral: e.target.value || null }))}
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
            placeholder="Contexto da aplicação, observações relevantes…"
          />
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSalvarMeta}
            disabled={salvarMeta.isPending}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "#006B54" }}
          >
            {salvarMeta.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Salvar Dados QPS
          </button>
        </div>
      </section>

      {/* ─── B2: Avaliação por Setor ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Avaliação por Setor
        </h2>

        {setores.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
            Nenhum setor cadastrado. Acesse <strong>Setores / Riscos</strong> para adicionar.
          </div>
        ) : (
          <>
            {/* Tabs de setor */}
            <div className="flex flex-wrap gap-2">
              {setores.map((s) => {
                const temRespostas = todasRespostas.some((r) => r.id_setor === s.id);
                const ativo = setorAtivo === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSetorAtivo(s.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                      ativo
                        ? "border-[#006B54] bg-[#006B54] text-white"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    )}
                  >
                    {s.nome_setor || "Setor sem nome"}
                    {temRespostas && (
                      <span className={cn(
                        "size-2 shrink-0 rounded-full",
                        ativo ? "bg-white/60" : "bg-green-400"
                      )} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Info do setor ativo */}
            {setorAtivoObj && (
              <p className="text-xs text-gray-500">
                Respondendo para: <strong className="text-gray-700">{setorAtivoObj.nome_setor}</strong>
                {setorAtivoObj.cargos.length > 0 && (
                  <> · {setorAtivoObj.cargos.map((c) => c.nome).filter(Boolean).join(", ")}</>
                )}
              </p>
            )}

            {/* Cards dos 13 fatores */}
            {fatores.map((fator) => {
              const isF13 = fator.codigo === "F13";
              const perguntasFator = perguntas.filter((p) => p.codigo_fator === fator.codigo);
              const mediaCalc = isF13
                ? null
                : calcularMediaFator(perguntas, respostasSetor, fator.codigo);
              const zonaCalc = isF13
                ? (zonasManuais[fator.codigo] ?? null)
                : zonaFromMedia(mediaCalc);
              const prazoSem = semaforo.find((s) => s.id === zonaCalc);
              const respondidas = respostasSetor.filter((r) => r.codigo_fator === fator.codigo).length;
              const aberto = abertos[fator.codigo] ?? false;

              return (
                <div
                  key={fator.codigo}
                  className="rounded-xl border bg-white shadow-sm overflow-hidden"
                  style={zonaCalc ? { borderLeftWidth: 4, borderLeftColor: ZONA_BORDER_L[zonaCalc] } : undefined}
                >
                  {/* Header */}
                  <button
                    type="button"
                    onClick={() => toggleAberto(fator.codigo)}
                    className="flex w-full items-center gap-3 px-5 py-4 text-left"
                  >
                    <span
                      className="shrink-0 rounded-md px-2 py-0.5 text-xs font-bold text-white"
                      style={{ background: "#006B54" }}
                    >
                      {fator.codigo}
                    </span>

                    <span className="flex-1 font-semibold text-gray-900 text-sm">{fator.nome}</span>

                    {/* Progresso */}
                    {!isF13 && (
                      <span className={cn(
                        "shrink-0 text-xs tabular-nums",
                        respondidas === perguntasFator.length && perguntasFator.length > 0
                          ? "text-green-600 font-semibold"
                          : "text-gray-400"
                      )}>
                        {respondidas}/{perguntasFator.length}
                      </span>
                    )}

                    {/* Média */}
                    {!isF13 && mediaCalc !== null && (
                      <span className="shrink-0 font-mono text-sm font-bold text-gray-800">
                        {mediaCalc.toFixed(2)}
                      </span>
                    )}

                    {/* Zona badge */}
                    {zonaCalc && (
                      <span className={cn(
                        "hidden sm:inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                        ZONA_CLASS[zonaCalc]
                      )}>
                        <span className={cn("size-1.5 rounded-full", ZONA_DOT[zonaCalc])} />
                        {ZONA_LABEL[zonaCalc].split(" — ")[1]}
                      </span>
                    )}

                    {aberto
                      ? <ChevronUp className="size-4 shrink-0 text-gray-400" />
                      : <ChevronDown className="size-4 shrink-0 text-gray-400" />}
                  </button>

                  {/* Body */}
                  {aberto && (
                    <div className="border-t border-gray-100 px-5 py-5 space-y-5">
                      <p className="text-xs text-gray-500 leading-relaxed">{fator.descricao}</p>

                      {isF13 ? (
                        /* F13: apenas zona manual */
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600">
                            Classificação (baseada no PGR)
                          </label>
                          <select
                            value={zonasManuais[fator.codigo] ?? ""}
                            onChange={(e) =>
                              setZonasManuais((prev) => ({
                                ...prev,
                                [fator.codigo]: (e.target.value as ZonaPsi) || null,
                              }))
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                          >
                            <option value="">Selecione a zona…</option>
                            {(["verde", "amarela", "laranja", "vermelha"] as ZonaPsi[]).map((z) => (
                              <option key={z} value={z}>{ZONA_LABEL[z]}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        /* F01–F12: perguntas 1-5 */
                        <div className="space-y-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                            Perguntas — Escala 1 (Nunca) a 5 (Sempre)
                          </p>

                          {perguntasFator.map((p, i) => {
                            const respostaAtual = respostasSetor.find(
                              (r) => r.codigo_fator === fator.codigo && r.pergunta_ordem === p.ordem
                            )?.resposta ?? null;

                            return (
                              <div
                                key={p.id}
                                className={cn(
                                  "rounded-lg border p-3 transition-colors",
                                  respostaAtual !== null
                                    ? "border-gray-200 bg-gray-50"
                                    : "border-dashed border-gray-200 bg-white"
                                )}
                              >
                                <div className="mb-3 flex gap-2">
                                  <span className="shrink-0 font-mono text-[10px] text-gray-400 mt-0.5">
                                    {String(i + 1).padStart(2, "0")}
                                  </span>
                                  <p className="flex-1 text-xs leading-relaxed text-gray-700">{p.texto}</p>
                                  <span className={cn(
                                    "shrink-0 self-start rounded px-1.5 py-0.5 text-[10px] font-medium",
                                    p.logica === "direta"
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-purple-100 text-purple-700"
                                  )}>
                                    {p.logica === "direta" ? "↑ D" : "↓ I"}
                                  </span>
                                </div>

                                {/* Botões 1-5 */}
                                <div className="flex gap-1.5">
                                  {ESCALA.map((v) => (
                                    <button
                                      key={v}
                                      type="button"
                                      onClick={() => handleResposta(fator.codigo, p.ordem, v)}
                                      title={`${v} — ${ESCALA_LABEL[v]}`}
                                      className={cn(
                                        "flex h-9 flex-1 items-center justify-center rounded-lg border text-sm font-bold transition-all",
                                        respostaAtual === v
                                          ? "border-[#006B54] bg-[#006B54] text-white shadow-sm"
                                          : "border-gray-200 bg-white text-gray-400 hover:border-gray-300 hover:text-gray-700"
                                      )}
                                    >
                                      {v}
                                    </button>
                                  ))}
                                </div>

                                {respostaAtual !== null && (
                                  <p className="mt-1.5 text-[10px] text-gray-400">
                                    {respostaAtual} — {ESCALA_LABEL[respostaAtual]}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Resultado calculado */}
                      {!isF13 && mediaCalc !== null && (
                        <div className={cn(
                          "flex items-center gap-4 rounded-lg border p-4",
                          zonaCalc ? ZONA_CLASS[zonaCalc] : "border-gray-200 bg-gray-50 text-gray-700"
                        )}>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide opacity-60 mb-0.5">
                              Média calculada
                            </p>
                            <p className="text-2xl font-bold tabular-nums">{mediaCalc.toFixed(2)}</p>
                          </div>
                          {zonaCalc && (
                            <div className="flex-1 border-l border-current/20 pl-4">
                              <p className="text-sm font-bold">{ZONA_LABEL[zonaCalc]}</p>
                              <p className="text-xs opacity-70">
                                {nivelPgrFromZona(zonaCalc)} · Prazo: {prazoSem?.prazo_texto ?? "—"}
                              </p>
                            </div>
                          )}
                          <div className="text-xs opacity-60 text-right">
                            <p className="font-semibold">{respondidas}/{perguntasFator.length}</p>
                            <p>respondidas</p>
                          </div>
                        </div>
                      )}

                      {/* Pergunta crítica + Observação */}
                      <div className="space-y-3 border-t border-gray-100 pt-4">
                        {!isF13 && (
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">
                              Pergunta Crítica
                            </label>
                            <input
                              type="text"
                              value={perguntasCriticas[fator.codigo] ?? ""}
                              onChange={(e) =>
                                setPerguntasCriticas((prev) => ({ ...prev, [fator.codigo]: e.target.value }))
                              }
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                              placeholder="Pergunta com pior score neste fator…"
                            />
                          </div>
                        )}

                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600">
                            Observação / Análise
                          </label>
                          <textarea
                            rows={3}
                            value={observacoes[fator.codigo] ?? ""}
                            onChange={(e) =>
                              setObservacoes((prev) => ({ ...prev, [fator.codigo]: e.target.value }))
                            }
                            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                            placeholder="Análise, contexto e achados relevantes…"
                          />
                        </div>

                        <div className="flex justify-end">
                          <button
                            onClick={() => handleSalvarFator(fator.codigo)}
                            disabled={salvandoFator === fator.codigo}
                            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            style={{ background: "#006B54" }}
                          >
                            {salvandoFator === fator.codigo
                              ? <Loader2 className="size-4 animate-spin" />
                              : <Save className="size-4" />}
                            Salvar {fator.codigo}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </section>

      {/* ─── B3: Resumo do setor ativo ───────────────────────────────────────── */}
      {setores.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Resumo — {setorAtivoObj?.nome_setor ?? "Setor"}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-3">Cód.</th>
                  <th className="px-4 py-3">Fator</th>
                  <th className="px-4 py-3 text-center">Respondidas</th>
                  <th className="px-4 py-3 text-center">Média</th>
                  <th className="px-4 py-3">Zona</th>
                  <th className="px-4 py-3">Nível PGR</th>
                  <th className="px-4 py-3">Prazo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {fatores.map((fator) => {
                  const isF13 = fator.codigo === "F13";
                  const perguntasFator = perguntas.filter((p) => p.codigo_fator === fator.codigo);
                  const mediaCalc = isF13
                    ? null
                    : calcularMediaFator(perguntas, respostasSetor, fator.codigo);
                  const zonaCalc = isF13
                    ? (zonasManuais[fator.codigo] ?? null)
                    : zonaFromMedia(mediaCalc);
                  const prazoSem = semaforo.find((s) => s.id === zonaCalc);
                  const respondidas = respostasSetor.filter((r) => r.codigo_fator === fator.codigo).length;

                  return (
                    <tr key={fator.codigo} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <span
                          className="rounded px-1.5 py-0.5 text-xs font-bold text-white"
                          style={{ background: "#006B54" }}
                        >
                          {fator.codigo}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{fator.nome}</td>
                      <td className="px-4 py-3 text-center text-gray-600 tabular-nums">
                        {isF13 ? "—" : `${respondidas}/${perguntasFator.length}`}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-gray-800">
                        {isF13 ? "—" : mediaCalc !== null ? mediaCalc.toFixed(2) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {zonaCalc ? (
                          <span className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                            ZONA_CLASS[zonaCalc]
                          )}>
                            <span className={cn("size-2 rounded-full", ZONA_DOT[zonaCalc])} />
                            {ZONA_LABEL[zonaCalc].split(" — ")[0]}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{nivelPgrFromZona(zonaCalc)}</td>
                      <td className="px-4 py-3 text-gray-600">{prazoSem?.prazo_texto ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
