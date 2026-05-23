"use client";

import { useState } from "react";
import {
  Brain,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  useAet13FatoresConfig,
  useAet13FatoresSalvarConfig,
  useAet13FatoresRestaurarConfig,
  useAet13FatoresPerguntas,
  useAet13FatoresSalvarPerguntas,
  useAet13FatoresRestaurarPerguntas,
  useAet13FatoresSemaforo,
  useAet13FatoresSalvarSemaforo,
  FATORES_DEFAULT,
  SEMAFORO_DEFAULT,
} from "@/lib/hooks/useAet";
import type { Aet13FatorConfig, Aet13FatorPergunta, Aet13FatorSemaforo } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type Aba = "fatores" | "perguntas" | "plano" | "semaforo";

export default function Config13FatoresPage() {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  useEffect(() => {
    if (user && user.perfil !== "Admin") router.replace("/aet");
  }, [user, router]);

  const [aba, setAba] = useState<Aba>("fatores");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Brain className="size-5 text-[#006B54]" />
          Config. 13 Fatores Psicossociais
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Personalize os fatores, perguntas QPS, plano de ação e classificação semafórica.
        </p>
      </div>

      {/* Abas */}
      <div className="flex gap-1 border-b border-gray-200">
        {(
          [
            { id: "fatores",   label: "Categorias (13 fatores)" },
            { id: "perguntas", label: "QPS (perguntas)" },
            { id: "plano",     label: "Plano de Ação" },
            { id: "semaforo",  label: "Classificação Semafórica" },
          ] as { id: Aba; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setAba(t.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              aba === t.id
                ? "border-[#006B54] text-[#006B54]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {aba === "fatores"   && <AbaFatores />}
      {aba === "perguntas" && <AbaPerguntas />}
      {aba === "plano"     && <AbaPlano />}
      {aba === "semaforo"  && <AbaSemaforo />}
    </div>
  );
}

// ─── Aba A1 — Categorias ─────────────────────────────────────────────────────

function AbaFatores() {
  const { data: raw = [], isLoading } = useAet13FatoresConfig();
  const salvar = useAet13FatoresSalvarConfig();
  const restaurar = useAet13FatoresRestaurarConfig();
  const [fatores, setFatores] = useState<Aet13FatorConfig[]>([]);
  const [abertos, setAbertos] = useState<Set<string>>(new Set(["F01"]));

  useEffect(() => { if (raw.length) setFatores(raw); }, [raw]);

  function setF(codigo: string, key: keyof Aet13FatorConfig, value: string) {
    setFatores((prev) => prev.map((f) => f.codigo === codigo ? { ...f, [key]: value } : f));
  }

  function toggle(codigo: string) {
    setAbertos((prev) => {
      const next = new Set(prev);
      next.has(codigo) ? next.delete(codigo) : next.add(codigo);
      return next;
    });
  }

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <button
          onClick={() => restaurar.mutate()}
          disabled={restaurar.isPending}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          {restaurar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
          Restaurar padrão
        </button>
        <button
          onClick={() => salvar.mutate(fatores)}
          disabled={salvar.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-[#006B54] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#005542] disabled:opacity-50"
        >
          {salvar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Salvar
        </button>
      </div>

      {fatores.map((f) => (
        <div key={f.codigo} className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <button
            onClick={() => toggle(f.codigo)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left"
          >
            {abertos.has(f.codigo) ? <ChevronDown className="size-4 text-[#006B54]" /> : <ChevronRight className="size-4 text-gray-400" />}
            <span className="rounded bg-[#006B54]/10 px-2 py-0.5 text-xs font-bold text-[#006B54]">{f.codigo}</span>
            <span className="font-semibold text-gray-800">{f.nome}</span>
          </button>
          {abertos.has(f.codigo) && (
            <div className="grid gap-4 border-t border-gray-100 px-4 pb-4 pt-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-600">Nome do fator</label>
                <input value={f.nome} onChange={(e) => setF(f.codigo, "nome", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#006B54]/40" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-600">Descrição</label>
                <textarea rows={2} value={f.descricao ?? ""} onChange={(e) => setF(f.codigo, "descricao", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#006B54]/40" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Perigos típicos</label>
                <textarea rows={3} value={f.perigos_tipicos ?? ""} onChange={(e) => setF(f.codigo, "perigos_tipicos", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#006B54]/40" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Possíveis danos à saúde</label>
                <textarea rows={3} value={f.possiveis_danos ?? ""} onChange={(e) => setF(f.codigo, "possiveis_danos", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#006B54]/40" />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Aba A2 — Perguntas QPS ──────────────────────────────────────────────────

function AbaPerguntas() {
  const { data: raw = [], isLoading } = useAet13FatoresPerguntas();
  const { data: fatores = [] } = useAet13FatoresConfig();
  const salvar = useAet13FatoresSalvarPerguntas();
  const restaurar = useAet13FatoresRestaurarPerguntas();
  const [perguntas, setPerguntas] = useState<Aet13FatorPergunta[]>([]);

  useEffect(() => { if (raw.length) setPerguntas(raw); }, [raw]);

  function setP(idx: number, key: keyof Aet13FatorPergunta, value: string) {
    setPerguntas((prev) => prev.map((p, i) => i === idx ? { ...p, [key]: value } : p));
  }

  function addPergunta() {
    const nova: Aet13FatorPergunta = {
      id: crypto.randomUUID(),
      codigo_fator: fatores[0]?.codigo ?? "F01",
      texto: "",
      logica: "invertida",
      ordem: perguntas.length + 1,
    };
    setPerguntas((prev) => [...prev, nova]);
  }

  function remover(idx: number) {
    setPerguntas((prev) => prev.filter((_, i) => i !== idx));
  }

  if (isLoading) return <Spinner />;

  const total = perguntas.length;
  const alertaTotal = total > 50 || total < 20;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className={cn("text-sm", alertaTotal ? "font-semibold text-amber-600" : "text-gray-500")}>
          {total} pergunta(s) {alertaTotal ? "⚠ recomendado: 20–50" : ""}
        </span>
        <div className="flex gap-2">
          <button onClick={addPergunta} className="flex items-center gap-1.5 rounded-lg border border-[#006B54] px-3 py-1.5 text-sm text-[#006B54] hover:bg-[#006B54]/5">
            <Plus className="size-3.5" /> Adicionar
          </button>
          <button onClick={() => restaurar.mutate()} disabled={restaurar.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            {restaurar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
            Restaurar padrão
          </button>
          <button onClick={() => salvar.mutate(perguntas)} disabled={salvar.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-[#006B54] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#005542] disabled:opacity-50">
            {salvar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Salvar
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="w-8 px-3 py-2.5 text-center">#</th>
              <th className="px-3 py-2.5 text-left">Categoria</th>
              <th className="px-3 py-2.5 text-left">Pergunta</th>
              <th className="w-28 px-3 py-2.5 text-left">Lógica</th>
              <th className="w-8 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {perguntas.map((p, idx) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-center text-xs text-gray-400">{idx + 1}</td>
                <td className="px-3 py-2">
                  <select value={p.codigo_fator} onChange={(e) => setP(idx, "codigo_fator", e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#006B54]">
                    {(fatores.length ? fatores : FATORES_DEFAULT).map((f) => (
                      <option key={f.codigo} value={f.codigo}>{f.codigo} — {f.nome}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input value={p.texto} onChange={(e) => setP(idx, "texto", e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#006B54]" />
                </td>
                <td className="px-3 py-2">
                  <select value={p.logica} onChange={(e) => setP(idx, "logica", e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#006B54]">
                    <option value="invertida">Invertida</option>
                    <option value="direta">Direta</option>
                  </select>
                </td>
                <td className="px-3 py-2 text-center">
                  <button onClick={() => remover(idx)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Aba A3 — Plano de Ação ──────────────────────────────────────────────────

const RESPONSAVEIS = ["RH", "SESMT", "Direção", "Gestão", "CIPA", "Compliance", "Jurídico"];
const PRAZOS = ["30 dias", "60 dias", "90 dias", "120 dias", "180 dias", "Conforme PGR"];

function AbaPlano() {
  const { data: raw = [], isLoading } = useAet13FatoresConfig();
  const salvar = useAet13FatoresSalvarConfig();
  const [fatores, setFatores] = useState<Aet13FatorConfig[]>([]);

  useEffect(() => { if (raw.length) setFatores(raw); }, [raw]);

  function setF(codigo: string, key: keyof Aet13FatorConfig, value: string) {
    setFatores((prev) => prev.map((f) => f.codigo === codigo ? { ...f, [key]: value } : f));
  }

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => salvar.mutate(fatores)} disabled={salvar.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-[#006B54] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#005542] disabled:opacity-50">
          {salvar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Salvar
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="w-16 px-3 py-2.5 text-left">Cód.</th>
              <th className="px-3 py-2.5 text-left">Foco</th>
              <th className="px-3 py-2.5 text-left">Ação proposta</th>
              <th className="w-40 px-3 py-2.5 text-left">Responsável</th>
              <th className="w-36 px-3 py-2.5 text-left">Prazo padrão</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {fatores.map((f) => (
              <tr key={f.codigo} className={cn("hover:bg-gray-50", (f.prazo_plano === "30 dias" || f.prazo_plano === "60 dias") && "bg-red-50/40")}>
                <td className="px-3 py-2">
                  <span className="rounded bg-[#006B54]/10 px-1.5 py-0.5 text-xs font-bold text-[#006B54]">{f.codigo}</span>
                </td>
                <td className="px-3 py-2">
                  <input value={f.foco_plano ?? ""} onChange={(e) => setF(f.codigo, "foco_plano", e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#006B54]" />
                </td>
                <td className="px-3 py-2">
                  <textarea rows={2} value={f.acao_plano ?? ""} onChange={(e) => setF(f.codigo, "acao_plano", e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#006B54]" />
                </td>
                <td className="px-3 py-2">
                  <select value={f.responsavel_plano ?? ""} onChange={(e) => setF(f.codigo, "responsavel_plano", e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#006B54]">
                    <option value="">Selecione</option>
                    {RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}
                    <option value={f.responsavel_plano ?? ""}>{f.responsavel_plano}</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select value={f.prazo_plano ?? ""} onChange={(e) => setF(f.codigo, "prazo_plano", e.target.value)}
                    className={cn("w-full rounded border px-2 py-1 text-xs focus:outline-none focus:ring-1",
                      (f.prazo_plano === "30 dias" || f.prazo_plano === "60 dias")
                        ? "border-red-300 text-red-700 focus:ring-red-400"
                        : "border-gray-300 focus:ring-[#006B54]")}>
                    <option value="">Selecione</option>
                    {PRAZOS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Aba A4 — Classificação Semafórica ───────────────────────────────────────

function AbaSemaforo() {
  const { data: raw = [], isLoading } = useAet13FatoresSemaforo();
  const salvar = useAet13FatoresSalvarSemaforo();
  const [rows, setRows] = useState<Aet13FatorSemaforo[]>([]);

  useEffect(() => { if (raw.length) setRows(raw); }, [raw]);

  function setR(id: string, key: keyof Aet13FatorSemaforo, value: string | number | null) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, [key]: value } : r));
  }

  if (isLoading) return <Spinner />;

  const ZONA_STYLE: Record<string, string> = {
    verde:    "border-green-200 bg-green-50",
    amarela:  "border-yellow-200 bg-yellow-50",
    laranja:  "border-orange-200 bg-orange-50",
    vermelha: "border-red-200 bg-red-50",
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <button onClick={() => { setRows(SEMAFORO_DEFAULT); toast("Valores padrão restaurados — clique em Salvar para confirmar.", { icon: "ℹ️" }); }}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
          <RotateCcw className="size-3.5" /> Restaurar padrão
        </button>
        <button onClick={() => salvar.mutate(rows)} disabled={salvar.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-[#006B54] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#005542] disabled:opacity-50">
          {salvar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Salvar
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.id} className={cn("rounded-xl border p-4", ZONA_STYLE[r.id] ?? "border-gray-200 bg-white")}>
            <p className="mb-3 text-sm font-bold text-gray-800">{r.label}</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="mb-1 block font-medium text-gray-600">Mín. (≥)</label>
                <input type="number" step="0.1" value={r.min_score ?? ""} onChange={(e) => setR(r.id, "min_score", e.target.value ? parseFloat(e.target.value) : null)}
                  className="w-full rounded border border-gray-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#006B54]" />
              </div>
              <div>
                <label className="mb-1 block font-medium text-gray-600">Máx. (&lt;)</label>
                <input type="number" step="0.1" value={r.max_score ?? ""} onChange={(e) => setR(r.id, "max_score", e.target.value ? parseFloat(e.target.value) : null)}
                  className="w-full rounded border border-gray-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#006B54]" />
              </div>
              <div>
                <label className="mb-1 block font-medium text-gray-600">Nível PGR</label>
                <input value={r.nivel_pgr} onChange={(e) => setR(r.id, "nivel_pgr", e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#006B54]" />
              </div>
              <div>
                <label className="mb-1 block font-medium text-gray-600">Prazo padrão</label>
                <input value={r.prazo_texto} onChange={(e) => setR(r.id, "prazo_texto", e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#006B54]" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-800">
        <strong>Mapeamento Nível PGR ↔ Prazo:</strong> Crítico → 30 dias · Alto → 90 dias · Moderado → 180 dias · Trivial → Monitoramento
      </div>
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="size-6 animate-spin text-gray-400" />
    </div>
  );
}
