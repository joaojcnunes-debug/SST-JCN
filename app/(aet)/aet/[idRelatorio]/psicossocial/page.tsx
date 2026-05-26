"use client";

import { use, useState, useEffect } from "react";
import { Brain, ChevronDown, ChevronUp, Loader2, Save, Sparkles } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
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
  useAetSalvarRespostasFator,
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rKey(idSetor: string, codigoFator: string, ordem: number) {
  return `${idSetor}|${codigoFator}|${ordem}`;
}

function perguntaCriticaAuto(
  perguntas: Aet13FatorPergunta[],
  localRespostas: Record<string, number>,
  idSetor: string,
  codigoFator: string
): string | null {
  const pFator = perguntas.filter((p) => p.codigo_fator === codigoFator);
  let worstScore = Infinity;
  let worstTexto: string | null = null;
  for (const p of pFator) {
    const r = localRespostas[rKey(idSetor, codigoFator, p.ordem)];
    if (r == null) continue;
    const score = p.logica === "direta" ? 6 - r : r;
    if (score < worstScore) {
      worstScore = score;
      worstTexto = p.texto;
    }
  }
  return worstTexto;
}

function calcularMediaFator(
  perguntas: Aet13FatorPergunta[],
  localRespostas: Record<string, number>,
  idSetor: string,
  codigoFator: string
): number | null {
  const pFator = perguntas.filter((p) => p.codigo_fator === codigoFator);
  if (pFator.length === 0) return null;
  const scores: number[] = [];
  for (const p of pFator) {
    const r = localRespostas[rKey(idSetor, codigoFator, p.ordem)];
    if (r == null) continue;
    scores.push(p.logica === "direta" ? 6 - r : r);
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
  const { data: respostasDB = [] } = useAetQpsRespostas(idRelatorio);

  const salvarMeta = useAetSalvarQpsMeta();
  const salvarFator = useAetSalvarFatorPsi();
  const salvarRespostas = useAetSalvarRespostasFator();

  // ─── State ────────────────────────────────────────────────────────────────

  // Setores abertos em acordeão (múltiplos simultâneos)
  const [setoresAbertos, setSetoresAbertos] = useState<Set<string>>(new Set());
  // Chave: `${setorId}:${codigoFator}`
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});

  const [localRespostas, setLocalRespostas] = useState<Record<string, number>>({});

  // Keyed por codigoFator (valor único por fator no laudo — limitação do schema atual)
  const [observacoes, setObservacoes] = useState<Record<string, string>>({});
  const [perguntasCriticas, setPerguntasCriticas] = useState<Record<string, string>>({});
  const [zonasManuais, setZonasManuais] = useState<Record<string, ZonaPsi | null>>({});

  // Chave: `${setorId}:${codigoFator}`
  const [salvandoFator, setSalvandoFator] = useState<string | null>(null);
  const [gerandoObsIA, setGerandoObsIA] = useState<string | null>(null);

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

  // Abre o primeiro setor por padrão
  useEffect(() => {
    if (rel?.setores.length && setoresAbertos.size === 0) {
      setSetoresAbertos(new Set([rel.setores[0].id]));
    }
  }, [rel, setoresAbertos.size]);

  // Init meta
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

  // Popula estado local com respostas salvas no banco
  useEffect(() => {
    if (respostasDB.length === 0) return;
    setLocalRespostas((prev) => {
      const next = { ...prev };
      for (const r of respostasDB) {
        next[rKey(r.id_setor, r.codigo_fator, r.pergunta_ordem)] = r.resposta;
      }
      return next;
    });
  }, [respostasDB]);

  // Auto-fill Pergunta Crítica para todos os setores abertos
  useEffect(() => {
    if (perguntas.length === 0 || setoresAbertos.size === 0) return;
    setPerguntasCriticas((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const setorId of Array.from(setoresAbertos)) {
        for (const fator of fatores) {
          if (fator.codigo === "F13") continue;
          if (prev[fator.codigo]) continue;
          const auto = perguntaCriticaAuto(perguntas, localRespostas, setorId, fator.codigo);
          if (auto) { next[fator.codigo] = auto; changed = true; }
        }
      }
      return changed ? next : prev;
    });
  }, [localRespostas, setoresAbertos, fatores, perguntas]);

  // Init observacoes / perguntasCriticas / zonasManuais
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

  // ─── Handlers ─────────────────────────────────────────────────────────────

  async function handleSalvarMeta() {
    try {
      await salvarMeta.mutateAsync(meta);
    } catch {
      // handled in hook
    }
  }

  function handleResposta(setorId: string, codigoFator: string, perguntaOrdem: number, value: number) {
    setLocalRespostas((prev) => ({
      ...prev,
      [rKey(setorId, codigoFator, perguntaOrdem)]: value,
    }));
  }

  async function handleSalvarFator(setorId: string, codigoFator: string) {
    const isF13 = codigoFator === "F13";
    const perguntasFator = perguntas.filter((p) => p.codigo_fator === codigoFator);
    const rows: AetLaudoQpsResposta[] = perguntasFator
      .map((p) => {
        const resposta = localRespostas[rKey(setorId, codigoFator, p.ordem)];
        if (resposta == null) return null;
        return {
          id_relatorio: idRelatorio,
          id_setor: setorId,
          codigo_fator: codigoFator,
          pergunta_ordem: p.ordem,
          resposta,
        };
      })
      .filter((r): r is AetLaudoQpsResposta => r !== null);

    const mediaCalc = isF13
      ? null
      : calcularMediaFator(perguntas, localRespostas, setorId, codigoFator);
    const zona = isF13
      ? (zonasManuais[codigoFator] ?? null)
      : zonaFromMedia(mediaCalc);

    const fatorKey = `${setorId}:${codigoFator}`;
    setSalvandoFator(fatorKey);
    try {
      await Promise.all([
        rows.length > 0 ? salvarRespostas.mutateAsync(rows) : Promise.resolve(),
        salvarFator.mutateAsync({
          id_relatorio: idRelatorio,
          codigo_fator: codigoFator,
          avaliado: true,
          media: mediaCalc,
          pct_zona_risco: null,
          pergunta_critica: perguntasCriticas[codigoFator] || null,
          observacao: observacoes[codigoFator] || null,
          zona,
        }),
      ]);
      toast.success(`Fator ${codigoFator} salvo`);
    } catch {
      // handled in hooks
    } finally {
      setSalvandoFator(null);
    }
  }

  async function gerarObsIA(setorId: string, codigoFator: string) {
    const fatorObj = fatores.find((f) => f.codigo === codigoFator);
    if (!fatorObj) return;
    const setorObj = setores.find((s) => s.id === setorId);
    const mediaCalc = calcularMediaFator(perguntas, localRespostas, setorId, codigoFator);
    const zona = zonaFromMedia(mediaCalc);
    const fatorKey = `${setorId}:${codigoFator}`;
    setGerandoObsIA(fatorKey);
    try {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.functions.invoke("gerar-observacao-psi-ia", {
        body: {
          empresa: rel?.empresas && "nome_empresa" in (rel.empresas as object)
            ? { nome: (rel.empresas as { nome_empresa: string }).nome_empresa }
            : null,
          setor: { nome: setorObj?.nome_setor ?? "Setor" },
          fator: { codigo: codigoFator, nome: fatorObj.nome, descricao: fatorObj.descricao },
          media: mediaCalc,
          zona,
          nivel_pgr: nivelPgrFromZona(zona),
          pergunta_critica: perguntasCriticas[codigoFator] || null,
          textoAtual: observacoes[codigoFator] || null,
        },
      });
      if (error) throw error;
      const obs = data?.data?.observacao ?? data?.observacao ?? "";
      if (obs) setObservacoes((prev) => ({ ...prev, [codigoFator]: obs }));
      else toast.error("IA não retornou texto");
    } catch {
      toast.error("Erro ao gerar com IA");
    } finally {
      setGerandoObsIA(null);
    }
  }

  function toggleSetor(setorId: string) {
    setSetoresAbertos((prev) => {
      const next = new Set(prev);
      next.has(setorId) ? next.delete(setorId) : next.add(setorId);
      return next;
    });
  }

  function toggleAberto(setorId: string, codigoFator: string) {
    const key = `${setorId}:${codigoFator}`;
    setAbertos((prev) => ({ ...prev, [key]: !prev[key] }));
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

      {/* ─── B2: Setores em acordeão ──────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Avaliação por Setor
        </h2>

        {setores.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
            Nenhum setor cadastrado. Acesse <strong>Setores / Riscos</strong> para adicionar.
          </div>
        ) : (
          <div className="space-y-3">
            {setores.map((setor, setorIdx) => {
              const isOpen = setoresAbertos.has(setor.id);
              const temRespostasSetor = respostasDB.some((r) => r.id_setor === setor.id);

              return (
                <div
                  key={setor.id}
                  className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                >
                  {/* Cabeçalho do setor — clicável */}
                  <button
                    type="button"
                    onClick={() => toggleSetor(setor.id)}
                    className="flex w-full items-center justify-between px-5 py-4 text-left"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">
                        Setor {setorIdx + 1}: {setor.nome_setor || "Sem nome"}
                      </span>
                      {setor.cargos.length > 0 && (
                        <span className="text-xs text-gray-500">
                          — {setor.cargos.map((c) => c.nome).filter(Boolean).join(", ")}
                        </span>
                      )}
                      {temRespostasSetor && (
                        <span className="size-2 shrink-0 rounded-full bg-green-400" />
                      )}
                    </span>
                    {isOpen
                      ? <ChevronUp className="size-4 shrink-0 text-gray-400" />
                      : <ChevronDown className="size-4 shrink-0 text-gray-400" />}
                  </button>

                  {/* Conteúdo do setor: 13 fatores + resumo */}
                  {isOpen && (
                    <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">

                      {/* Cards dos 13 fatores deste setor */}
                      {fatores.map((fator) => {
                        const isF13 = fator.codigo === "F13";
                        const perguntasFator = perguntas.filter((p) => p.codigo_fator === fator.codigo);
                        const mediaCalc = isF13
                          ? null
                          : calcularMediaFator(perguntas, localRespostas, setor.id, fator.codigo);
                        const zonaCalc = isF13
                          ? (zonasManuais[fator.codigo] ?? null)
                          : zonaFromMedia(mediaCalc);
                        const prazoSem = semaforo.find((s) => s.id === zonaCalc);
                        const respondidas = perguntasFator.filter(
                          (p) => localRespostas[rKey(setor.id, fator.codigo, p.ordem)] != null
                        ).length;
                        const fatorKey = `${setor.id}:${fator.codigo}`;
                        const aberto = abertos[fatorKey] ?? false;

                        return (
                          <div
                            key={fator.codigo}
                            className="rounded-xl border bg-white shadow-sm overflow-hidden"
                            style={zonaCalc ? { borderLeftWidth: 4, borderLeftColor: ZONA_BORDER_L[zonaCalc] } : undefined}
                          >
                            {/* Header do fator */}
                            <button
                              type="button"
                              onClick={() => toggleAberto(setor.id, fator.codigo)}
                              className="flex w-full items-center gap-3 px-5 py-4 text-left"
                            >
                              <span
                                className="shrink-0 rounded-md px-2 py-0.5 text-xs font-bold text-white"
                                style={{ background: "#006B54" }}
                              >
                                {fator.codigo}
                              </span>

                              <span className="flex-1 font-semibold text-gray-900 text-sm">{fator.nome}</span>

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

                              {!isF13 && mediaCalc !== null && (
                                <span className="shrink-0 font-mono text-sm font-bold text-gray-800">
                                  {mediaCalc.toFixed(2)}
                                </span>
                              )}

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

                            {/* Body do fator */}
                            {aberto && (
                              <div className="border-t border-gray-100 px-5 py-5 space-y-5">
                                <p className="text-xs text-gray-500 leading-relaxed">{fator.descricao}</p>

                                {isF13 ? (
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
                                  <div className="space-y-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                                      Perguntas — clique para selecionar e salve ao final
                                    </p>

                                    {perguntasFator.map((p, i) => {
                                      const respostaAtual = localRespostas[rKey(setor.id, fator.codigo, p.ordem)] ?? null;

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

                                          <div className="grid grid-cols-5 gap-1.5">
                                            {ESCALA.map((v) => (
                                              <button
                                                key={v}
                                                type="button"
                                                onClick={() => handleResposta(setor.id, fator.codigo, p.ordem, v)}
                                                className={cn(
                                                  "flex flex-col items-center justify-center gap-0.5 rounded-lg border py-2 px-1 text-center transition-all",
                                                  respostaAtual === v
                                                    ? "border-[#006B54] bg-[#006B54] text-white shadow-sm"
                                                    : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700"
                                                )}
                                              >
                                                <span className={cn(
                                                  "text-[10px] font-bold tabular-nums",
                                                  respostaAtual === v ? "text-white/70" : "text-gray-400"
                                                )}>
                                                  {v}
                                                </span>
                                                <span className="text-[10px] font-medium leading-tight">
                                                  {ESCALA_LABEL[v]}
                                                </span>
                                              </button>
                                            ))}
                                          </div>
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

                                {/* Pergunta crítica + Observação + Salvar */}
                                <div className="space-y-3 border-t border-gray-100 pt-4">
                                  {!isF13 && (
                                    <div>
                                      <label className="mb-1 block text-xs font-medium text-gray-600">
                                        Pergunta Crítica
                                      </label>
                                      <textarea
                                        rows={2}
                                        value={perguntasCriticas[fator.codigo] ?? ""}
                                        onChange={(e) =>
                                          setPerguntasCriticas((prev) => ({ ...prev, [fator.codigo]: e.target.value }))
                                        }
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-y"
                                        placeholder="Pergunta com pior score neste fator…"
                                      />
                                    </div>
                                  )}

                                  <div>
                                    <div className="mb-1 flex items-center justify-between gap-2">
                                      <label className="text-xs font-medium text-gray-600">
                                        Observação / Análise
                                      </label>
                                      {!isF13 && (
                                        <button
                                          type="button"
                                          onClick={() => gerarObsIA(setor.id, fator.codigo)}
                                          disabled={gerandoObsIA === fatorKey}
                                          className="inline-flex items-center gap-1.5 rounded-md border border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50 px-2.5 py-1 text-xs font-semibold text-purple-700 hover:from-purple-100 hover:to-pink-100 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          {gerandoObsIA === fatorKey
                                            ? <Loader2 className="size-3 animate-spin" />
                                            : <Sparkles className="size-3" />}
                                          {gerandoObsIA === fatorKey ? "Gerando…" : "Gerar com IA"}
                                        </button>
                                      )}
                                    </div>
                                    <textarea
                                      rows={3}
                                      value={observacoes[fator.codigo] ?? ""}
                                      onChange={(e) =>
                                        setObservacoes((prev) => ({ ...prev, [fator.codigo]: e.target.value }))
                                      }
                                      className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                                      placeholder="Análise, contexto e achados relevantes…"
                                    />
                                  </div>

                                  <div className="flex justify-end">
                                    <button
                                      onClick={() => handleSalvarFator(setor.id, fator.codigo)}
                                      disabled={salvandoFator === fatorKey}
                                      className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                                      style={{ background: "#006B54" }}
                                    >
                                      {salvandoFator === fatorKey
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

                      {/* Resumo do setor */}
                      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                        <div className="border-b border-gray-100 px-5 py-4">
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                            Resumo — {setor.nome_setor || `Setor ${setorIdx + 1}`}
                          </h3>
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
                                  : calcularMediaFator(perguntas, localRespostas, setor.id, fator.codigo);
                                const zonaCalc = isF13
                                  ? (zonasManuais[fator.codigo] ?? null)
                                  : zonaFromMedia(mediaCalc);
                                const prazoSem = semaforo.find((s) => s.id === zonaCalc);
                                const respondidas = perguntasFator.filter(
                                  (p) => localRespostas[rKey(setor.id, fator.codigo, p.ordem)] != null
                                ).length;

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
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
