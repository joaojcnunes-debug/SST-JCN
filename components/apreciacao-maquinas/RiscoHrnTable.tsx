"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";
import {
  useRiscosHrn,
  useCriarRiscoHrn,
  useAtualizarRiscoHrn,
  useExcluirRiscoHrn,
  type RiscoHrnInput,
} from "@/lib/hooks/useRiscosHrn";
import {
  POD_HRN_LABELS,
  FEP_HRN_LABELS,
  GPD_HRN_LABELS,
  NPE_HRN_LABELS,
  CLASSIFICACAO_HRN_LABELS,
  calcularClassificacaoHrn,
  type PodHrn,
  type FepHrn,
  type GpdHrn,
  type NpeHrn,
  type ClassificacaoRiscoHrn,
  type RiscoHrn,
} from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-gray-50 disabled:text-gray-500";

const CLASSIFICACAO_CORES: Record<ClassificacaoRiscoHrn, string> = {
  ALTO: "bg-red-100 text-red-700 border-red-300",
  MEDIO: "bg-amber-100 text-amber-700 border-amber-300",
  BAIXO: "bg-emerald-100 text-emerald-700 border-emerald-300",
  DESPREZIVEL: "bg-gray-100 text-gray-600 border-gray-300",
};

const BLANK_INPUT: RiscoHrnInput = {
  tipo_perigo: "",
  origem: null,
  potenciais_consequencias: null,
  pod: null,
  fep: null,
  gpd: null,
  npe_item: null,
  classificacao_risco: null,
  nivel_acoes: null,
  medidas_preventivas: null,
  ordem: 0,
};

function RiscoRow({
  risco,
  disabled,
  idApreciacao,
}: {
  risco: RiscoHrn;
  disabled: boolean;
  idApreciacao: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState<Partial<RiscoHrnInput>>({});
  const atualizar = useAtualizarRiscoHrn(idApreciacao);
  const excluir = useExcluirRiscoHrn(idApreciacao);

  const actual = { ...risco, ...form };
  const sugerida = calcularClassificacaoHrn(actual.pod, actual.fep, actual.gpd);
  const classeAtual = actual.classificacao_risco;

  function setF<K extends keyof RiscoHrnInput>(key: K, val: RiscoHrnInput[K]) {
    const next: Partial<RiscoHrnInput> = { ...form, [key]: val };
    if ((key === "pod" || key === "fep" || key === "gpd") && !next.classificacao_risco) {
      const sug = calcularClassificacaoHrn(
        key === "pod" ? val as string : (next.pod ?? null),
        key === "fep" ? val as string : (next.fep ?? null),
        key === "gpd" ? val as string : (next.gpd ?? null),
      );
      if (sug) next.classificacao_risco = sug;
    }
    setForm(next);
  }

  async function handleSalvar() {
    if (!Object.keys(form).length) return;
    try {
      await atualizar.mutateAsync({ id_risco: risco.id_risco, ...form });
      setForm({});
      toast.success("Risco atualizado");
    } catch {
      // error handled by hook
    }
  }

  async function handleExcluir() {
    try {
      await excluir.mutateAsync(risco.id_risco);
    } catch {
      // error handled by hook
    }
  }

  const dirty = Object.keys(form).length > 0;

  return (
    <div className="rounded-md border border-gray-200 bg-white">
      {/* Linha resumo */}
      <div
        className="flex cursor-pointer items-start gap-2 px-3 py-2 hover:bg-gray-50"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-800 truncate">
            {actual.tipo_perigo || <span className="text-gray-400 italic">sem título</span>}
          </p>
          <p className="text-[10px] text-gray-500 truncate">
            {actual.origem || "—"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {classeAtual && (
            <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-bold", CLASSIFICACAO_CORES[classeAtual])}>
              {CLASSIFICACAO_HRN_LABELS[classeAtual]}
            </span>
          )}
          {sugerida && sugerida !== classeAtual && (
            <span className="text-[10px] text-gray-400">(sug: {CLASSIFICACAO_HRN_LABELS[sugerida]})</span>
          )}
          {expanded ? <ChevronUp className="size-3.5 text-gray-400" /> : <ChevronDown className="size-3.5 text-gray-400" />}
        </div>
      </div>

      {/* Detalhes expandidos */}
      {expanded && (
        <div className="border-t border-gray-100 px-3 pb-3 pt-2 space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-0.5 block text-[10px] font-semibold uppercase text-gray-500">Tipo do Perigo *</span>
              <input type="text" value={actual.tipo_perigo} onChange={(e) => setF("tipo_perigo", e.target.value)} disabled={disabled} className={inputClass} placeholder="Ex: Aprisionamento por Esteira" />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[10px] font-semibold uppercase text-gray-500">Origem</span>
              <input type="text" value={actual.origem ?? ""} onChange={(e) => setF("origem", e.target.value || null)} disabled={disabled} className={inputClass} placeholder="Ex: Desgaste de peças" />
            </label>
          </div>
          <label className="block">
            <span className="mb-0.5 block text-[10px] font-semibold uppercase text-gray-500">Potenciais Consequências</span>
            <input type="text" value={actual.potenciais_consequencias ?? ""} onChange={(e) => setF("potenciais_consequencias", e.target.value || null)} disabled={disabled} className={inputClass} placeholder="Ex: Laceração, Amputação" />
          </label>
          {/* Matriz HRN */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="block">
              <span className="mb-0.5 block text-[10px] font-semibold uppercase text-gray-500">POD</span>
              <select value={actual.pod ?? ""} onChange={(e) => setF("pod", (e.target.value as PodHrn) || null as never)} disabled={disabled} className={inputClass}>
                <option value="">—</option>
                {(Object.entries(POD_HRN_LABELS) as [PodHrn, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[10px] font-semibold uppercase text-gray-500">FEP</span>
              <select value={actual.fep ?? ""} onChange={(e) => setF("fep", (e.target.value as FepHrn) || null as never)} disabled={disabled} className={inputClass}>
                <option value="">—</option>
                {(Object.entries(FEP_HRN_LABELS) as [FepHrn, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[10px] font-semibold uppercase text-gray-500">GPD</span>
              <select value={actual.gpd ?? ""} onChange={(e) => setF("gpd", (e.target.value as GpdHrn) || null as never)} disabled={disabled} className={inputClass}>
                <option value="">—</option>
                {(Object.entries(GPD_HRN_LABELS) as [GpdHrn, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[10px] font-semibold uppercase text-gray-500">NPE</span>
              <select value={actual.npe_item ?? ""} onChange={(e) => setF("npe_item", (e.target.value as NpeHrn) || null as never)} disabled={disabled} className={inputClass}>
                <option value="">—</option>
                {(Object.entries(NPE_HRN_LABELS) as [NpeHrn, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-0.5 block text-[10px] font-semibold uppercase text-gray-500">
              Classificação do Risco
              {sugerida && (
                <button type="button" onClick={() => setF("classificacao_risco", sugerida)} className="ml-2 text-orange-600 underline hover:text-orange-800">
                  usar sugerida ({CLASSIFICACAO_HRN_LABELS[sugerida]})
                </button>
              )}
            </span>
            <select value={actual.classificacao_risco ?? ""} onChange={(e) => setF("classificacao_risco", (e.target.value as ClassificacaoRiscoHrn) || null as never)} disabled={disabled} className={inputClass}>
              <option value="">—</option>
              {(Object.entries(CLASSIFICACAO_HRN_LABELS) as [ClassificacaoRiscoHrn, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[10px] font-semibold uppercase text-gray-500">Nível das Ações Preventivas</span>
            <input type="text" value={actual.nivel_acoes ?? ""} onChange={(e) => setF("nivel_acoes", e.target.value || null)} disabled={disabled} className={inputClass} placeholder="Ex: Imediato, Curto prazo, Monitorar" />
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[10px] font-semibold uppercase text-gray-500">Medidas Preventivas Indicadas</span>
            <textarea rows={2} value={actual.medidas_preventivas ?? ""} onChange={(e) => setF("medidas_preventivas", e.target.value || null)} disabled={disabled} className={inputClass} placeholder="Descreva as medidas preventivas ou corretivas indicadas..." />
          </label>

          {!disabled && (
            <div className="flex items-center justify-between pt-1">
              <button type="button" onClick={handleExcluir} disabled={excluir.isPending} className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50">
                {excluir.isPending ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                Remover
              </button>
              {dirty && (
                <button type="button" onClick={handleSalvar} disabled={atualizar.isPending} className="inline-flex items-center gap-1 rounded bg-orange-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-orange-700 disabled:opacity-50">
                  {atualizar.isPending ? <Loader2 className="size-3 animate-spin" /> : null}
                  Salvar alterações
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RiscoHrnTable({
  idApreciacao,
  disabled = false,
}: {
  idApreciacao: string;
  disabled?: boolean;
}) {
  const { data: riscos = [], isLoading } = useRiscosHrn(idApreciacao);
  const criar = useCriarRiscoHrn(idApreciacao);
  const [novoForm, setNovoForm] = useState<RiscoHrnInput>({ ...BLANK_INPUT });
  const [adicionando, setAdicionando] = useState(false);

  function setNF<K extends keyof RiscoHrnInput>(key: K, val: RiscoHrnInput[K]) {
    const next = { ...novoForm, [key]: val };
    if ((key === "pod" || key === "fep" || key === "gpd") && !next.classificacao_risco) {
      const sug = calcularClassificacaoHrn(
        key === "pod" ? val as string : next.pod,
        key === "fep" ? val as string : next.fep,
        key === "gpd" ? val as string : next.gpd,
      );
      if (sug) next.classificacao_risco = sug;
    }
    setNovoForm(next);
  }

  async function handleAdicionar() {
    if (!novoForm.tipo_perigo.trim()) {
      toast.error("Tipo do perigo é obrigatório");
      return;
    }
    try {
      await criar.mutateAsync({ ...novoForm, ordem: riscos.length });
      setNovoForm({ ...BLANK_INPUT });
      setAdicionando(false);
      toast.success("Risco adicionado");
    } catch {
      // handled
    }
  }

  const sugeridaNovo = calcularClassificacaoHrn(novoForm.pod, novoForm.fep, novoForm.gpd);

  if (isLoading) {
    return (
      <div className="flex items-center gap-1 text-xs text-gray-500">
        <Loader2 className="size-3 animate-spin" /> Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {riscos.length === 0 && !adicionando && (
        <p className="rounded-md border border-dashed border-gray-200 bg-gray-50 p-3 text-center text-xs text-gray-500">
          Nenhum risco cadastrado ainda.{" "}
          {!disabled && 'Clique em "Adicionar risco" para começar.'}
        </p>
      )}

      {riscos.map((r) => (
        <RiscoRow key={r.id_risco} risco={r} disabled={disabled} idApreciacao={idApreciacao} />
      ))}

      {/* Formulário de novo risco */}
      {!disabled && adicionando && (
        <div className="rounded-md border-2 border-dashed border-orange-200 bg-orange-50/30 p-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-orange-700">
            Novo risco HRN
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-0.5 block text-[10px] font-semibold uppercase text-gray-500">Tipo do Perigo *</span>
              <input type="text" value={novoForm.tipo_perigo} onChange={(e) => setNF("tipo_perigo", e.target.value)} className={inputClass} placeholder="Ex: Aprisionamento por Esteira" />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[10px] font-semibold uppercase text-gray-500">Origem</span>
              <input type="text" value={novoForm.origem ?? ""} onChange={(e) => setNF("origem", e.target.value || null)} className={inputClass} placeholder="Ex: Desgaste de peças" />
            </label>
          </div>
          <label className="block">
            <span className="mb-0.5 block text-[10px] font-semibold uppercase text-gray-500">Potenciais Consequências</span>
            <input type="text" value={novoForm.potenciais_consequencias ?? ""} onChange={(e) => setNF("potenciais_consequencias", e.target.value || null)} className={inputClass} placeholder="Ex: Laceração, Amputação" />
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="block">
              <span className="mb-0.5 block text-[10px] font-semibold uppercase text-gray-500">POD</span>
              <select value={novoForm.pod ?? ""} onChange={(e) => setNF("pod", (e.target.value as PodHrn) || null as never)} className={inputClass}>
                <option value="">—</option>
                {(Object.entries(POD_HRN_LABELS) as [PodHrn, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[10px] font-semibold uppercase text-gray-500">FEP</span>
              <select value={novoForm.fep ?? ""} onChange={(e) => setNF("fep", (e.target.value as FepHrn) || null as never)} className={inputClass}>
                <option value="">—</option>
                {(Object.entries(FEP_HRN_LABELS) as [FepHrn, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[10px] font-semibold uppercase text-gray-500">GPD</span>
              <select value={novoForm.gpd ?? ""} onChange={(e) => setNF("gpd", (e.target.value as GpdHrn) || null as never)} className={inputClass}>
                <option value="">—</option>
                {(Object.entries(GPD_HRN_LABELS) as [GpdHrn, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[10px] font-semibold uppercase text-gray-500">NPE</span>
              <select value={novoForm.npe_item ?? ""} onChange={(e) => setNF("npe_item", (e.target.value as NpeHrn) || null as never)} className={inputClass}>
                <option value="">—</option>
                {(Object.entries(NPE_HRN_LABELS) as [NpeHrn, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-0.5 block text-[10px] font-semibold uppercase text-gray-500">
              Classificação do Risco
              {sugeridaNovo && (
                <button type="button" onClick={() => setNF("classificacao_risco", sugeridaNovo)} className="ml-2 text-orange-600 underline hover:text-orange-800">
                  usar sugerida ({CLASSIFICACAO_HRN_LABELS[sugeridaNovo]})
                </button>
              )}
            </span>
            <select value={novoForm.classificacao_risco ?? ""} onChange={(e) => setNF("classificacao_risco", (e.target.value as ClassificacaoRiscoHrn) || null as never)} className={inputClass}>
              <option value="">—</option>
              {(Object.entries(CLASSIFICACAO_HRN_LABELS) as [ClassificacaoRiscoHrn, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[10px] font-semibold uppercase text-gray-500">Medidas Preventivas Indicadas</span>
            <textarea rows={2} value={novoForm.medidas_preventivas ?? ""} onChange={(e) => setNF("medidas_preventivas", e.target.value || null)} className={inputClass} placeholder="Descreva as medidas preventivas..." />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setAdicionando(false); setNovoForm({ ...BLANK_INPUT }); }} className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="button" onClick={handleAdicionar} disabled={criar.isPending} className="inline-flex items-center gap-1 rounded-md bg-orange-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50">
              {criar.isPending ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
              Adicionar
            </button>
          </div>
        </div>
      )}

      {!disabled && !adicionando && (
        <button type="button" onClick={() => setAdicionando(true)} className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-orange-300 bg-orange-50/30 px-3 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-100">
          <Plus className="size-3.5" /> Adicionar risco
        </button>
      )}
    </div>
  );
}
