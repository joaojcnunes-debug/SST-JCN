"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  useInvestigacaoAcoes,
  useCriarInvestigacaoAcao,
  useAtualizarInvestigacaoAcao,
  useExcluirInvestigacaoAcao,
} from "@/lib/hooks/useInvestigacaoAcoes";
import type {
  InvestigacaoAcao,
  StatusAcaoApreciacao,
  PrioridadeAcaoApreciacao,
} from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const STATUS_OPCOES: StatusAcaoApreciacao[] = ["Pendente", "Em Andamento", "Concluida", "Cancelada"];
const PRIORIDADE_OPCOES: PrioridadeAcaoApreciacao[] = ["Baixa", "Media", "Alta", "Critica"];

const STATUS_CORES: Record<StatusAcaoApreciacao, string> = {
  Pendente: "bg-amber-100 text-amber-700 border-amber-200",
  "Em Andamento": "bg-blue-100 text-blue-700 border-blue-200",
  Concluida: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Cancelada: "bg-gray-100 text-gray-500 border-gray-200",
};

const PRIORIDADE_CORES: Record<PrioridadeAcaoApreciacao, string> = {
  Critica: "bg-red-100 text-red-700",
  Alta: "bg-orange-100 text-orange-700",
  Media: "bg-amber-100 text-amber-700",
  Baixa: "bg-emerald-100 text-emerald-700",
};

export default function PlanoAcaoTable({
  idInvestigacao,
  readOnly = false,
}: {
  idInvestigacao: string;
  readOnly?: boolean;
}) {
  const { data: acoes = [], isLoading } = useInvestigacaoAcoes(idInvestigacao);
  const criar = useCriarInvestigacaoAcao();
  const [expandida, setExpandida] = useState<string | null>(null);

  const totalPorStatus = useMemo(() => {
    const r: Record<StatusAcaoApreciacao, number> = {
      Pendente: 0,
      "Em Andamento": 0,
      Concluida: 0,
      Cancelada: 0,
    };
    acoes.forEach((a) => {
      r[a.status] += 1;
    });
    return r;
  }, [acoes]);

  async function handleAdicionar() {
    try {
      const row = await criar.mutateAsync({
        id_investigacao: idInvestigacao,
        ordem: acoes.length,
        what_acao: "Nova ação",
      });
      setExpandida(row.id_acao);
    } catch {
      // toast de erro já emitido pelo hook
    }
  }

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAdicionar}
            disabled={criar.isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-verde-primary/40 bg-white px-3 py-1.5 text-xs font-semibold text-verde-primary hover:bg-verde-primary/5 disabled:opacity-50"
          >
            {criar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Adicionar ação
          </button>
          <p className="ml-auto text-[11px] text-gray-500">
            {acoes.length} ação(ões) · {totalPorStatus.Pendente} pendente(s) · {totalPorStatus.Concluida} concluída(s)
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-4 text-gray-400">
          <Loader2 className="size-4 animate-spin" />
        </div>
      ) : acoes.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-6 text-center text-xs text-gray-500">
          Nenhuma ação cadastrada. {readOnly ? "" : "Use “Adicionar ação” para montar o plano 5W2H."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
          {acoes.map((a) => (
            <AcaoRow
              key={a.id_acao}
              acao={a}
              expandida={expandida === a.id_acao}
              onToggle={() => setExpandida((cur) => (cur === a.id_acao ? null : a.id_acao))}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AcaoRow({
  acao,
  expandida,
  onToggle,
  readOnly,
}: {
  acao: InvestigacaoAcao;
  expandida: boolean;
  onToggle: () => void;
  readOnly: boolean;
}) {
  const atualizar = useAtualizarInvestigacaoAcao();
  const excluir = useExcluirInvestigacaoAcao();

  const [whatAcao, setWhatAcao] = useState(acao.what_acao);
  const [whyJust, setWhyJust] = useState(acao.why_justificativa ?? "");
  const [whereLocal, setWhereLocal] = useState(acao.where_local ?? "");
  const [whenPrazo, setWhenPrazo] = useState(acao.when_prazo ?? "");
  const [whoResp, setWhoResp] = useState(acao.who_responsavel ?? "");
  const [howMetodo, setHowMetodo] = useState(acao.how_metodo ?? "");
  const [howMuch, setHowMuch] = useState(acao.how_much_custo ?? "");

  function salvarStatusOuPrioridade(campo: "status" | "prioridade", valor: string) {
    atualizar.mutate({
      id_investigacao: acao.id_investigacao,
      id_acao: acao.id_acao,
      [campo]: valor,
    } as never);
  }

  function salvarCampos() {
    atualizar.mutate({
      id_investigacao: acao.id_investigacao,
      id_acao: acao.id_acao,
      what_acao: whatAcao.trim() || "Nova ação",
      why_justificativa: whyJust || null,
      where_local: whereLocal || null,
      when_prazo: whenPrazo || null,
      who_responsavel: whoResp || null,
      how_metodo: howMetodo || null,
      how_much_custo: howMuch || null,
    });
  }

  async function handleExcluir() {
    if (!confirm("Excluir esta ação?")) return;
    try {
      await excluir.mutateAsync({
        id_investigacao: acao.id_investigacao,
        id_acao: acao.id_acao,
      });
      toast.success("Ação excluída");
    } catch {
      // toast de erro já emitido pelo hook
    }
  }

  const concluida = acao.status === "Concluida";

  return (
    <div className={cn("border-b border-gray-100 last:border-b-0", concluida && "bg-emerald-50/30")}>
      <div className="flex items-start gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          className="mt-0.5 shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100"
          aria-label={expandida ? "Recolher" : "Expandir"}
        >
          <ChevronRight className={cn("size-3.5 transition-transform", expandida && "rotate-90")} />
        </button>
        <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold", PRIORIDADE_CORES[acao.prioridade])}>
          {acao.prioridade}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-sm font-medium text-gray-900", concluida && "line-through opacity-70")}>
            {acao.what_acao}
          </p>
        </div>
        <div className="hidden shrink-0 items-center gap-2 text-[11px] text-gray-500 sm:flex">
          {acao.who_responsavel && <span title="Responsável">{acao.who_responsavel}</span>}
          {acao.when_prazo && (
            <span title="Prazo">{new Date(acao.when_prazo + "T00:00").toLocaleDateString("pt-BR")}</span>
          )}
        </div>
        {readOnly ? (
          <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold", STATUS_CORES[acao.status])}>
            {acao.status}
          </span>
        ) : (
          <select
            value={acao.status}
            onChange={(e) => salvarStatusOuPrioridade("status", e.target.value)}
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-verde-primary",
              STATUS_CORES[acao.status],
            )}
          >
            {STATUS_OPCOES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
      </div>

      {expandida && (
        <div className="space-y-2 border-t border-gray-100 bg-gray-50/40 px-3 py-3">
          <Campo label="O quê (ação)">
            <input
              type="text"
              value={whatAcao}
              onChange={(e) => setWhatAcao(e.target.value)}
              onBlur={salvarCampos}
              disabled={readOnly}
              className={inputClass}
            />
          </Campo>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Campo label="Por quê (justificativa)">
              <textarea
                rows={2}
                value={whyJust}
                onChange={(e) => setWhyJust(e.target.value)}
                onBlur={salvarCampos}
                disabled={readOnly}
                className={inputClass}
              />
            </Campo>
            <Campo label="Como (método)">
              <textarea
                rows={2}
                value={howMetodo}
                onChange={(e) => setHowMetodo(e.target.value)}
                onBlur={salvarCampos}
                disabled={readOnly}
                className={inputClass}
              />
            </Campo>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <Campo label="Onde">
              <input
                type="text"
                value={whereLocal}
                onChange={(e) => setWhereLocal(e.target.value)}
                onBlur={salvarCampos}
                disabled={readOnly}
                className={inputClass}
              />
            </Campo>
            <Campo label="Quem (responsável)">
              <input
                type="text"
                value={whoResp}
                onChange={(e) => setWhoResp(e.target.value)}
                onBlur={salvarCampos}
                disabled={readOnly}
                className={inputClass}
              />
            </Campo>
            <Campo label="Quando (prazo)">
              <input
                type="date"
                value={whenPrazo}
                onChange={(e) => setWhenPrazo(e.target.value)}
                onBlur={salvarCampos}
                disabled={readOnly}
                className={inputClass}
              />
            </Campo>
            <Campo label="Quanto (custo)">
              <input
                type="text"
                value={howMuch}
                onChange={(e) => setHowMuch(e.target.value)}
                onBlur={salvarCampos}
                disabled={readOnly}
                className={inputClass}
                placeholder="R$ ..."
              />
            </Campo>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Campo label="Prioridade">
              <select
                value={acao.prioridade}
                onChange={(e) => salvarStatusOuPrioridade("prioridade", e.target.value)}
                disabled={readOnly}
                className={cn(inputClass, "w-auto")}
              >
                {PRIORIDADE_OPCOES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </Campo>
            {!readOnly && (
              <button
                type="button"
                onClick={handleExcluir}
                disabled={excluir.isPending}
                className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="size-3" /> Excluir
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30 disabled:bg-gray-50";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-600">{label}</span>
      {children}
    </label>
  );
}
