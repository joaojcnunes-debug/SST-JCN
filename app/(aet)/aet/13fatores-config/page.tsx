"use client";

import Dica from "@/components/ui/Dica";
import { DICAS_13FATORES_CONFIG } from "@/lib/dicas/config";
import { useState, type ReactNode } from "react";
import {
  Brain,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronRight,
  Lock,
} from "lucide-react";
import { ConfirmHost, confirmar } from "@/components/ui/confirm";
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
import { ehSupervisor } from "@/lib/hooks/useUsuario";

type Aba = "fatores" | "perguntas" | "plano" | "semaforo";

export default function Config13FatoresPage() {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  useEffect(() => {
    if (user && !ehSupervisor(user)) router.replace("/aet");
  }, [user, router]);

  const [aba, setAba] = useState<Aba>("fatores");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Brain className="size-5 text-[#0ea5e9]" />
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
                ? "border-[#0ea5e9] text-[#0ea5e9]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* As quatro abas ficam MONTADAS e só a ativa aparece (04/11/2026). Antes
          trocar de aba desmontava a anterior e as alterações não salvas sumiam
          sem aviso. Escondida, a aba guarda o que foi digitado até o Salvar. */}
      <div className={cn(aba !== "fatores" && "hidden")}><AbaFatores /></div>
      <div className={cn(aba !== "perguntas" && "hidden")}><AbaPerguntas /></div>
      <div className={cn(aba !== "plano" && "hidden")}><AbaPlano /></div>
      <div className={cn(aba !== "semaforo" && "hidden")}><AbaSemaforo /></div>
      <ConfirmHost />
    </div>
  );
}

/** Aviso de campo que o sistema não usa (ou usa valor fixo): fica só leitura. */
function AvisoSoLeitura({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <Lock className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

// Campo travado: o mesmo visual de campo desabilitado da Config. OWAS.
const TRAVADO = "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500";

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

  // Restaurar GRAVA na hora (upsert dos 13 padrões) e desfaz nome e descrição
  // editados de todos os fatores — por isso pede confirmação antes.
  async function handleRestaurar() {
    const ok = await confirmar({
      title: "Restaurar os 13 fatores ao padrão?",
      description: "Nome e descrição de todos os fatores voltam ao texto original e isso é gravado agora. As edições feitas aqui se perdem.",
      confirmLabel: "Restaurar",
      variant: "primary",
    });
    if (ok) restaurar.mutate();
  }

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <button
          onClick={handleRestaurar}
          disabled={restaurar.isPending}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          {restaurar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
          Restaurar padrão
        </button>
        <button
          onClick={() => salvar.mutate(fatores)}
          disabled={salvar.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-[#0ea5e9] px-4 py-1.5 text-sm font-semibold text-white hover:bg-marca-accent disabled:opacity-50"
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
            {abertos.has(f.codigo) ? <ChevronDown className="size-4 text-[#0ea5e9]" /> : <ChevronRight className="size-4 text-gray-400" />}
            <span className="rounded bg-[#0ea5e9]/10 px-2 py-0.5 text-xs font-bold text-[#0ea5e9]">{f.codigo}</span>
            <span className="font-semibold text-gray-800">{f.nome}</span>
          </button>
          {abertos.has(f.codigo) && (
            <div className="grid gap-4 border-t border-gray-100 px-4 pb-4 pt-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-600"><Dica texto={DICAS_13FATORES_CONFIG.nome}>Nome do fator</Dica></label>
                <input value={f.nome} onChange={(e) => setF(f.codigo, "nome", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/40" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-600"><Dica texto={DICAS_13FATORES_CONFIG.descricao}>Descrição</Dica></label>
                <textarea rows={2} value={f.descricao ?? ""} onChange={(e) => setF(f.codigo, "descricao", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/40" />
              </div>
              {/* Perigos e danos: nenhuma tela, laudo, PDF ou IA lê estas
                  colunas. Ficam à vista, travadas, para ninguém editar achando
                  que muda o documento (04/11/2026). */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600"><Dica texto={DICAS_13FATORES_CONFIG.perigos}>Perigos típicos</Dica></label>
                <textarea rows={3} value={f.perigos_tipicos ?? ""} disabled readOnly
                  className={cn("w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm", TRAVADO)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600"><Dica texto={DICAS_13FATORES_CONFIG.danos}>Possíveis danos à saúde</Dica></label>
                <textarea rows={3} value={f.possiveis_danos ?? ""} disabled readOnly
                  className={cn("w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm", TRAVADO)} />
              </div>
              <div className="sm:col-span-2">
                <AvisoSoLeitura>Perigos típicos e Possíveis danos são só leitura: o laudo, o PDF e a IA não usam estes campos.</AvisoSoLeitura>
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
      // 0 = "ainda sem número": o Salvar dá a próxima ordem livre. Era
      // `perguntas.length + 1`, que repetia uma ordem existente quando a
      // lista tinha buraco (ver lib/aet/ordem-perguntas.ts).
      ordem: 0,
    };
    setPerguntas((prev) => [...prev, nova]);
  }

  function remover(idx: number) {
    setPerguntas((prev) => prev.filter((_, i) => i !== idx));
  }

  // Restaurar GRAVA na hora: troca o conjunto inteiro pelas 50 perguntas padrão.
  async function handleRestaurar() {
    const ok = await confirmar({
      title: "Restaurar as perguntas QPS ao padrão?",
      description: "As 50 perguntas padrão voltam e isso é gravado agora. Perguntas criadas aqui são apagadas e textos editados se perdem.",
      confirmLabel: "Restaurar",
      variant: "primary",
    });
    if (ok) restaurar.mutate();
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
          <button onClick={addPergunta} className="flex items-center gap-1.5 rounded-lg border border-[#0ea5e9] px-3 py-1.5 text-sm text-[#0ea5e9] hover:bg-[#0ea5e9]/5">
            <Plus className="size-3.5" /> Adicionar
          </button>
          <button onClick={handleRestaurar} disabled={restaurar.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            {restaurar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
            Restaurar padrão
          </button>
          <button onClick={() => salvar.mutate(perguntas)} disabled={salvar.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-[#0ea5e9] px-4 py-1.5 text-sm font-semibold text-white hover:bg-marca-accent disabled:opacity-50">
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
              <th className="px-3 py-2.5 text-left"><Dica texto={DICAS_13FATORES_CONFIG.categoria}>Categoria</Dica></th>
              <th className="px-3 py-2.5 text-left"><Dica texto={DICAS_13FATORES_CONFIG.pergunta}>Pergunta</Dica></th>
              <th className="w-28 px-3 py-2.5 text-left"><Dica texto={DICAS_13FATORES_CONFIG.logica}>Lógica</Dica></th>
              <th className="w-8 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {perguntas.map((p, idx) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-center text-xs text-gray-400">{idx + 1}</td>
                <td className="px-3 py-2">
                  <select value={p.codigo_fator} onChange={(e) => setP(idx, "codigo_fator", e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#0ea5e9]">
                    {(fatores.length ? fatores : FATORES_DEFAULT).map((f) => (
                      <option key={f.codigo} value={f.codigo}>{f.codigo} — {f.nome}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input value={p.texto} onChange={(e) => setP(idx, "texto", e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#0ea5e9]" />
                </td>
                <td className="px-3 py-2">
                  <select value={p.logica} onChange={(e) => setP(idx, "logica", e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#0ea5e9]">
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

function AbaPlano() {
  const { data: fatores = [], isLoading } = useAet13FatoresConfig();

  if (isLoading) return <Spinner />;

  // Só leitura desde 04/11/2026: o plano de ação do laudo (aet_acoes, 5W2H) é
  // montado no próprio laudo e não lê NENHUMA destas colunas. Editar aqui não
  // mudava documento algum — por isso não há mais Salvar nesta aba.
  return (
    <div className="space-y-3">
      <AvisoSoLeitura>
        Só leitura: o plano de ação do laudo é feito no próprio laudo e não usa Foco, Ação proposta, Responsável nem Prazo daqui.
      </AvisoSoLeitura>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="w-16 px-3 py-2.5 text-left">Cód.</th>
              <th className="px-3 py-2.5 text-left"><Dica texto={DICAS_13FATORES_CONFIG.plano}>Foco</Dica></th>
              <th className="px-3 py-2.5 text-left"><Dica texto={DICAS_13FATORES_CONFIG.plano}>Ação proposta</Dica></th>
              <th className="w-40 px-3 py-2.5 text-left"><Dica texto={DICAS_13FATORES_CONFIG.plano}>Responsável</Dica></th>
              <th className="w-36 px-3 py-2.5 text-left"><Dica texto={DICAS_13FATORES_CONFIG.plano}>Prazo padrão</Dica></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {fatores.map((f) => (
              <tr key={f.codigo}>
                <td className="px-3 py-2">
                  <span className="rounded bg-[#0ea5e9]/10 px-1.5 py-0.5 text-xs font-bold text-[#0ea5e9]">{f.codigo}</span>
                </td>
                <td className="px-3 py-2">
                  <input value={f.foco_plano ?? ""} disabled readOnly
                    className={cn("w-full rounded border border-gray-300 px-2 py-1 text-xs", TRAVADO)} />
                </td>
                <td className="px-3 py-2">
                  <textarea rows={2} value={f.acao_plano ?? ""} disabled readOnly
                    className={cn("w-full rounded border border-gray-300 px-2 py-1 text-xs", TRAVADO)} />
                </td>
                <td className="px-3 py-2">
                  <input value={f.responsavel_plano ?? ""} disabled readOnly
                    className={cn("w-full rounded border border-gray-300 px-2 py-1 text-xs", TRAVADO)} />
                </td>
                <td className="px-3 py-2">
                  <input value={f.prazo_plano ?? ""} disabled readOnly
                    className={cn("w-full rounded border border-gray-300 px-2 py-1 text-xs", TRAVADO)} />
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
          className="flex items-center gap-1.5 rounded-lg bg-[#0ea5e9] px-4 py-1.5 text-sm font-semibold text-white hover:bg-marca-accent disabled:opacity-50">
          {salvar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Salvar
        </button>
      </div>

      {/* Mín., Máx. e Nível PGR travados (04/11/2026): a zona sai de faixas
          fixas (zonaFromMedia, lib/aet/consolidar-psi.ts) e o nível, da zona
          (nivelPgrFromZona). Editar aqui não mudava laudo nem PDF. */}
      <AvisoSoLeitura>
        Mín., Máx. e Nível PGR são só leitura: o laudo usa os valores fixos (4,0 · 3,0 · 2,0). O Prazo padrão continua editável.
      </AvisoSoLeitura>

      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.id} className={cn("rounded-xl border p-4", ZONA_STYLE[r.id] ?? "border-gray-200 bg-white")}>
            <p className="mb-3 text-sm font-bold text-gray-800">{r.label}</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="mb-1 block font-medium text-gray-600"><Dica texto={DICAS_13FATORES_CONFIG.minimo}>Mín. (≥)</Dica></label>
                <input type="number" value={r.min_score ?? ""} disabled readOnly
                  className={cn("w-full rounded border border-gray-300 px-2 py-1", TRAVADO)} />
              </div>
              <div>
                <label className="mb-1 block font-medium text-gray-600"><Dica texto={DICAS_13FATORES_CONFIG.maximo}>Máx. (&lt;)</Dica></label>
                <input type="number" value={r.max_score ?? ""} disabled readOnly
                  className={cn("w-full rounded border border-gray-300 px-2 py-1", TRAVADO)} />
              </div>
              <div>
                <label className="mb-1 block font-medium text-gray-600"><Dica texto={DICAS_13FATORES_CONFIG.nivel_pgr}>Nível PGR</Dica></label>
                <input value={r.nivel_pgr} disabled readOnly
                  className={cn("w-full rounded border border-gray-300 px-2 py-1", TRAVADO)} />
              </div>
              <div>
                <label className="mb-1 block font-medium text-gray-600"><Dica texto={DICAS_13FATORES_CONFIG.prazo}>Prazo padrão</Dica></label>
                <input value={r.prazo_texto} onChange={(e) => setR(r.id, "prazo_texto", e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#0ea5e9]" />
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
