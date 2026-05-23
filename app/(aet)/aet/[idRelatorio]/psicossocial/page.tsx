"use client";

import { use, useState, useEffect, useCallback } from "react";
import {
  Brain,
  ChevronDown,
  ChevronUp,
  Loader2,
  Save,
} from "lucide-react";
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
  zonaFromMedia,
  nivelPgrFromZona,
  SEMAFORO_DEFAULT,
} from "@/lib/hooks/useAet";
import { cn } from "@/lib/utils";
import type {
  AetLaudoQpsMeta,
  ZonaPsi,
} from "@/lib/supabase/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const MODOS_APLICACAO = [
  "Presencial — papel",
  "Presencial — digital",
  "Remoto — link",
  "Híbrido",
];

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

  const salvarMeta = useAetSalvarQpsMeta();
  const salvarFator = useAetSalvarFatorPsi();

  // ─── Meta state ───────────────────────────────────────────────────────────

  const [meta, setMeta] = useState<Omit<AetLaudoQpsMeta, "updated_at">>({
    id_relatorio: idRelatorio,
    n_respondentes: null,
    total_elegivel: null,
    periodo_inicio: null,
    periodo_fim: null,
    modo_aplicacao: null,
    observacao_geral: null,
  });

  useEffect(() => {
    if (qpsMeta) {
      setMeta({
        id_relatorio: idRelatorio,
        n_respondentes: qpsMeta.n_respondentes,
        total_elegivel: qpsMeta.total_elegivel,
        periodo_inicio: qpsMeta.periodo_inicio,
        periodo_fim: qpsMeta.periodo_fim,
        modo_aplicacao: qpsMeta.modo_aplicacao,
        observacao_geral: qpsMeta.observacao_geral,
      });
    }
  }, [qpsMeta, idRelatorio]);

  const adesaoPct =
    meta.n_respondentes && meta.total_elegivel && meta.total_elegivel > 0
      ? Math.round((meta.n_respondentes / meta.total_elegivel) * 100)
      : null;

  async function handleSalvarMeta() {
    try {
      await salvarMeta.mutateAsync(meta);
    } catch {
      // toast handled in hook
    }
  }

  // ─── Fatores state ────────────────────────────────────────────────────────

  type FatorLocal = {
    avaliado: boolean;
    media: string;
    pct_zona_risco: string;
    pergunta_critica: string;
    observacao: string;
    zona_manual: ZonaPsi | null;
  };

  const [fatorState, setFatorState] = useState<Record<string, FatorLocal>>({});
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (fatores.length === 0) return;
    const init: Record<string, FatorLocal> = {};
    for (const f of fatores) {
      const saved = fatoresPsi.find((fp) => fp.codigo_fator === f.codigo);
      init[f.codigo] = {
        avaliado: saved?.avaliado ?? false,
        media: saved?.media != null ? String(saved.media) : "",
        pct_zona_risco: saved?.pct_zona_risco != null ? String(saved.pct_zona_risco) : "",
        pergunta_critica: saved?.pergunta_critica ?? "",
        observacao: saved?.observacao ?? "",
        zona_manual: f.codigo === "F13" ? (saved?.zona ?? null) : null,
      };
    }
    setFatorState(init);
  }, [fatores, fatoresPsi]);

  const updateFator = useCallback(
    (codigo: string, patch: Partial<FatorLocal>) => {
      setFatorState((prev) => ({
        ...prev,
        [codigo]: { ...prev[codigo], ...patch },
      }));
    },
    []
  );

  function toggleAberto(codigo: string) {
    setAbertos((prev) => ({ ...prev, [codigo]: !prev[codigo] }));
  }

  async function handleSalvarFator(codigo: string) {
    const s = fatorState[codigo];
    if (!s) return;
    const mediaNum = s.media !== "" ? parseFloat(s.media) : null;
    const pctNum = s.pct_zona_risco !== "" ? parseFloat(s.pct_zona_risco) : null;
    const zona =
      codigo === "F13"
        ? s.zona_manual
        : zonaFromMedia(mediaNum);

    try {
      await salvarFator.mutateAsync({
        id_relatorio: idRelatorio,
        codigo_fator: codigo,
        avaliado: s.avaliado,
        media: mediaNum,
        pct_zona_risco: pctNum,
        pergunta_critica: s.pergunta_critica || null,
        observacao: s.observacao || null,
        zona,
      });
      toast.success(`Fator ${codigo} salvo`);
    } catch {
      // toast handled in hook
    }
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
          <h1 className="text-lg font-bold text-gray-900">
            13 Fatores Psicossociais
          </h1>
          <p className="text-sm text-gray-500">
            {rel?.empresas && "nome_empresa" in (rel.empresas as object)
              ? (rel.empresas as { nome_empresa: string }).nome_empresa
              : ""}
          </p>
        </div>
      </div>

      {/* ─── B1: Metadados QPS ─────────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Dados da Aplicação QPS
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* N respondentes */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              N.º de Respondentes
            </label>
            <input
              type="number"
              min={0}
              value={meta.n_respondentes ?? ""}
              onChange={(e) =>
                setMeta((m) => ({
                  ...m,
                  n_respondentes: e.target.value ? Number(e.target.value) : null,
                }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ "--tw-ring-color": "#006B54" } as React.CSSProperties}
              placeholder="ex: 42"
            />
          </div>

          {/* Total elegível */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Total Elegível
            </label>
            <input
              type="number"
              min={0}
              value={meta.total_elegivel ?? ""}
              onChange={(e) =>
                setMeta((m) => ({
                  ...m,
                  total_elegivel: e.target.value ? Number(e.target.value) : null,
                }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
              placeholder="ex: 50"
            />
          </div>

          {/* Adesão (calculado) */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              % Adesão
            </label>
            <div
              className={cn(
                "flex h-[38px] items-center rounded-lg border px-3 text-sm font-semibold",
                adesaoPct !== null
                  ? adesaoPct >= 70
                    ? "border-green-300 bg-green-50 text-green-700"
                    : "border-yellow-300 bg-yellow-50 text-yellow-700"
                  : "border-gray-200 bg-gray-50 text-gray-400"
              )}
            >
              {adesaoPct !== null ? `${adesaoPct}%` : "—"}
            </div>
          </div>

          {/* Período início */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Período — Início
            </label>
            <input
              type="date"
              value={meta.periodo_inicio ?? ""}
              onChange={(e) =>
                setMeta((m) => ({ ...m, periodo_inicio: e.target.value || null }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
            />
          </div>

          {/* Período fim */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Período — Fim
            </label>
            <input
              type="date"
              value={meta.periodo_fim ?? ""}
              onChange={(e) =>
                setMeta((m) => ({ ...m, periodo_fim: e.target.value || null }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
            />
          </div>

          {/* Modo de aplicação */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Modo de Aplicação
            </label>
            <select
              value={meta.modo_aplicacao ?? ""}
              onChange={(e) =>
                setMeta((m) => ({ ...m, modo_aplicacao: e.target.value || null }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
            >
              <option value="">Selecione…</option>
              {MODOS_APLICACAO.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Observação geral */}
        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Observação Geral
          </label>
          <textarea
            rows={3}
            value={meta.observacao_geral ?? ""}
            onChange={(e) =>
              setMeta((m) => ({ ...m, observacao_geral: e.target.value || null }))
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none"
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
            {salvarMeta.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Salvar Dados QPS
          </button>
        </div>
      </section>

      {/* ─── B2: Cards dos 13 Fatores ──────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Avaliação dos 13 Fatores
        </h2>

        {fatores.map((fator) => {
          const s = fatorState[fator.codigo];
          if (!s) return null;

          const isF13 = fator.codigo === "F13";
          const perguntasFator = perguntas.filter(
            (p) => p.codigo_fator === fator.codigo
          );
          const mediaNum = s.media !== "" ? parseFloat(s.media) : null;
          const zonaCalc = isF13 ? s.zona_manual : zonaFromMedia(mediaNum);
          const prazoSem = semaforo.find((sm) => sm.id === zonaCalc);
          const aberto = abertos[fator.codigo] ?? false;

          return (
            <div
              key={fator.codigo}
              className={cn(
                "rounded-xl border bg-white shadow-sm transition-all",
                s.avaliado ? "border-gray-200" : "border-dashed border-gray-300 opacity-75"
              )}
            >
              {/* Header do card */}
              <button
                type="button"
                onClick={() => toggleAberto(fator.codigo)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left"
              >
                {/* Código badge */}
                <span
                  className="shrink-0 rounded-md px-2 py-0.5 text-xs font-bold text-white"
                  style={{ background: "#006B54" }}
                >
                  {fator.codigo}
                </span>

                <span className="flex-1 font-semibold text-gray-900">
                  {fator.nome}
                </span>

                {/* Zona indicator */}
                {zonaCalc && (
                  <span
                    className={cn(
                      "hidden shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold sm:inline-block",
                      ZONA_CLASS[zonaCalc]
                    )}
                  >
                    {ZONA_LABEL[zonaCalc]}
                  </span>
                )}

                {/* Avaliado toggle */}
                <label
                  className="flex shrink-0 cursor-pointer items-center gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-xs text-gray-500">Avaliado</span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={s.avaliado}
                      onChange={(e) =>
                        updateFator(fator.codigo, { avaliado: e.target.checked })
                      }
                    />
                    <div
                      className={cn(
                        "h-5 w-9 rounded-full transition-colors",
                        s.avaliado ? "bg-[#006B54]" : "bg-gray-300"
                      )}
                    />
                    <div
                      className={cn(
                        "absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform",
                        s.avaliado ? "translate-x-4" : "translate-x-0.5"
                      )}
                    />
                  </div>
                </label>

                {aberto ? (
                  <ChevronUp className="size-4 shrink-0 text-gray-400" />
                ) : (
                  <ChevronDown className="size-4 shrink-0 text-gray-400" />
                )}
              </button>

              {/* Corpo expandido */}
              {aberto && (
                <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                  {/* Descrição */}
                  <p className="text-xs text-gray-500">{fator.descricao}</p>

                  {/* Zona indicator mobile */}
                  {zonaCalc && (
                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-lg border p-3 sm:hidden",
                        ZONA_CLASS[zonaCalc]
                      )}
                    >
                      <div className={cn("size-3 rounded-full", ZONA_DOT[zonaCalc])} />
                      <span className="text-sm font-semibold">{ZONA_LABEL[zonaCalc]}</span>
                      {prazoSem && (
                        <span className="ml-auto text-xs opacity-75">
                          Prazo: {prazoSem.prazo_texto}
                        </span>
                      )}
                    </div>
                  )}

                  {!isF13 ? (
                    /* Campos para F01–F12 */
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">
                          Média (0,00 – 5,00)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={5}
                          step={0.01}
                          value={s.media}
                          onChange={(e) =>
                            updateFator(fator.codigo, { media: e.target.value })
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                          placeholder="ex: 3.45"
                        />
                        {zonaCalc && (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <div className={cn("size-2.5 rounded-full", ZONA_DOT[zonaCalc])} />
                            <span className="text-xs text-gray-500">
                              {ZONA_LABEL[zonaCalc]} · {nivelPgrFromZona(zonaCalc)} ·{" "}
                              {prazoSem?.prazo_texto}
                            </span>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">
                          % em Zona de Risco
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={s.pct_zona_risco}
                            onChange={(e) =>
                              updateFator(fator.codigo, { pct_zona_risco: e.target.value })
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                            placeholder="ex: 32.5"
                          />
                          <span className="shrink-0 text-sm text-gray-400">%</span>
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-xs font-medium text-gray-600">
                          Pergunta Crítica
                        </label>
                        <input
                          type="text"
                          value={s.pergunta_critica}
                          onChange={(e) =>
                            updateFator(fator.codigo, { pergunta_critica: e.target.value })
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                          placeholder="Transcreva ou resuma a pergunta com pior score…"
                        />
                      </div>
                    </div>
                  ) : (
                    /* F13: apenas zona manual */
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Classificação (baseada no PGR)
                      </label>
                      <select
                        value={s.zona_manual ?? ""}
                        onChange={(e) =>
                          updateFator(fator.codigo, {
                            zona_manual: (e.target.value as ZonaPsi) || null,
                          })
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                      >
                        <option value="">Selecione a zona…</option>
                        {(["verde", "amarela", "laranja", "vermelha"] as ZonaPsi[]).map(
                          (z) => (
                            <option key={z} value={z}>
                              {ZONA_LABEL[z]}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  )}

                  {/* Observação (todos os fatores) */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Observação / Análise
                    </label>
                    <textarea
                      rows={3}
                      value={s.observacao}
                      onChange={(e) =>
                        updateFator(fator.codigo, { observacao: e.target.value })
                      }
                      className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                      placeholder="Análise, contexto e achados relevantes para este fator…"
                    />
                  </div>

                  {/* Perguntas QPS (read-only) */}
                  {perguntasFator.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Perguntas QPS associadas
                      </p>
                      <ul className="space-y-1.5">
                        {perguntasFator.map((p, i) => (
                          <li
                            key={p.id}
                            className="flex gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600"
                          >
                            <span className="shrink-0 font-mono text-gray-400">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span className="flex-1">{p.texto}</span>
                            <span
                              className={cn(
                                "shrink-0 rounded px-1.5 py-0.5 font-medium",
                                p.logica === "direta"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-purple-100 text-purple-700"
                              )}
                            >
                              {p.logica === "direta" ? "↑ Direta" : "↓ Invertida"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Salvar fator */}
                  <div className="flex justify-end border-t border-gray-100 pt-3">
                    <button
                      onClick={() => handleSalvarFator(fator.codigo)}
                      disabled={salvarFator.isPending}
                      className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      style={{ background: "#006B54" }}
                    >
                      {salvarFator.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Save className="size-4" />
                      )}
                      Salvar {fator.codigo}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* ─── B3: Tabela de resumo ──────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Resumo Consolidado
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">Cód.</th>
                <th className="px-4 py-3">Fator</th>
                <th className="px-4 py-3 text-center">Média</th>
                <th className="px-4 py-3 text-center">% Risco</th>
                <th className="px-4 py-3">Zona</th>
                <th className="px-4 py-3">Nível PGR</th>
                <th className="px-4 py-3">Prazo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {fatores.map((fator) => {
                const s = fatorState[fator.codigo];
                if (!s) return null;
                const isF13 = fator.codigo === "F13";
                const mediaNum = s.media !== "" ? parseFloat(s.media) : null;
                const zonaCalc = isF13 ? s.zona_manual : zonaFromMedia(mediaNum);
                const prazoSem = semaforo.find((sm) => sm.id === zonaCalc);

                return (
                  <tr
                    key={fator.codigo}
                    className={cn(
                      "transition-colors",
                      !s.avaliado && "opacity-40"
                    )}
                  >
                    <td className="px-4 py-3">
                      <span
                        className="rounded px-1.5 py-0.5 text-xs font-bold text-white"
                        style={{ background: "#006B54" }}
                      >
                        {fator.codigo}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {fator.nome}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">
                      {isF13 ? "—" : mediaNum != null ? mediaNum.toFixed(2) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">
                      {isF13 || s.pct_zona_risco === ""
                        ? "—"
                        : `${parseFloat(s.pct_zona_risco).toFixed(1)}%`}
                    </td>
                    <td className="px-4 py-3">
                      {zonaCalc ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                            ZONA_CLASS[zonaCalc]
                          )}
                        >
                          <div
                            className={cn("size-2 rounded-full", ZONA_DOT[zonaCalc])}
                          />
                          {ZONA_LABEL[zonaCalc].split(" — ")[0]}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {nivelPgrFromZona(zonaCalc)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {prazoSem?.prazo_texto ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
