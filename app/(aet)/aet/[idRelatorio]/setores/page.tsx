"use client";

import { useEffect, useState, use } from "react";
import { Plus, Trash2, Save, Loader2, ChevronDown, ChevronUp, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAetRelatorio, useSalvarAet, setorVazio } from "@/lib/hooks/useAet";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import { cn } from "@/lib/utils";
import type { AetSetor, AetRisco, TipoRiscoAET, ClassificacaoRiscoAET } from "@/lib/supabase/types";

const TIPOS_RISCO: TipoRiscoAET[] = ["Acidentes", "Ergonômico", "Físico", "Químico", "Biológico"];
const CLASSIFICACOES: ClassificacaoRiscoAET[] = ["Trivial", "De Atenção", "Moderado", "Alto", "Crítico"];
const CLASS_COLOR: Record<ClassificacaoRiscoAET, string> = {
  Trivial: "bg-green-100 text-green-800",
  "De Atenção": "bg-yellow-100 text-yellow-800",
  Moderado: "bg-orange-100 text-orange-800",
  Alto: "bg-red-100 text-red-800",
  Crítico: "bg-red-200 text-red-900",
};

export default function AetSetoresPage({
  params,
}: {
  params: Promise<{ idRelatorio: string }>;
}) {
  const { idRelatorio } = use(params);
  const { data: rel, isLoading } = useAetRelatorio(idRelatorio);
  const salvar = useSalvarAet();
  const canEdit = useCanEdit();

  const [setores, setSetores] = useState<AetSetor[]>([]);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (rel) {
      setSetores(rel.setores ?? []);
      if (rel.setores?.length) setAbertos(new Set([rel.setores[0].id]));
    }
  }, [rel]);

  function toggle(id: string) {
    setAbertos((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function addSetor() {
    const novo = setorVazio();
    setSetores((s) => [...s, novo]);
    setAbertos((prev) => new Set([...prev, novo.id]));
  }

  function removeSetor(id: string) {
    setSetores((s) => s.filter((x) => x.id !== id));
  }

  function updateSetor(id: string, patch: Partial<AetSetor>) {
    setSetores((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function addRisco(setorId: string) {
    const risco: AetRisco = {
      id: crypto.randomUUID(),
      tipo: "Acidentes",
      risco: "",
      intensidade_concentracao: "N/A",
      tecnica_metodologia: "Qualitativa",
      epi_ca: "N/A",
      epi_eficaz: "N/A",
      classificacao_risco: "Moderado",
    };
    updateSetor(setorId, {
      riscos: [...(setores.find((s) => s.id === setorId)?.riscos ?? []), risco],
    });
  }

  function removeRisco(setorId: string, riscoId: string) {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor) return;
    updateSetor(setorId, { riscos: setor.riscos.filter((r) => r.id !== riscoId) });
  }

  function updateRisco(setorId: string, riscoId: string, patch: Partial<AetRisco>) {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor) return;
    updateSetor(setorId, {
      riscos: setor.riscos.map((r) => (r.id === riscoId ? { ...r, ...patch } : r)),
    });
  }

  function handleSave() {
    salvar.mutate(
      { id: idRelatorio, patch: { setores } },
      {
        onSuccess: () => toast.success("Setores salvos"),
        onError: (e: Error) => toast.error(e.message),
      }
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Setores / Riscos</h1>
          <p className="text-xs text-gray-500">Seções 9 e 13 — agentes ambientais e análise por setor</p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <>
              <button
                type="button"
                onClick={addSetor}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Plus className="size-4" /> Setor
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={salvar.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
              >
                {salvar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Salvar
              </button>
            </>
          )}
        </div>
      </div>

      {setores.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
          Nenhum setor adicionado. {canEdit && "Clique em \"+ Setor\" para começar."}
        </div>
      ) : (
        setores.map((setor, idx) => (
          <div key={setor.id} className="rounded-xl border border-gray-200 bg-white shadow-sm">
            {/* Header do setor */}
            <button
              type="button"
              onClick={() => toggle(setor.id)}
              className="flex w-full items-center justify-between px-5 py-3 text-left"
            >
              <span className="font-semibold text-gray-900">
                Setor {idx + 1}: {setor.nome_setor || <span className="italic text-gray-400">Sem nome</span>}
              </span>
              <div className="flex items-center gap-2">
                {canEdit && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); removeSetor(setor.id); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); removeSetor(setor.id); } }}
                    className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="size-4" />
                  </span>
                )}
                {abertos.has(setor.id) ? <ChevronUp className="size-4 text-gray-400" /> : <ChevronDown className="size-4 text-gray-400" />}
              </div>
            </button>

            {abertos.has(setor.id) && (
              <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-4">
                {/* Dados do setor */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <TextInput
                    label="Nome do Setor"
                    value={setor.nome_setor}
                    disabled={!canEdit}
                    onChange={(v) => updateSetor(setor.id, { nome_setor: v })}
                  />
                  <TagInput
                    label="Cargo(s)"
                    value={setor.cargos}
                    disabled={!canEdit}
                    onChange={(v) => updateSetor(setor.id, { cargos: v })}
                  />
                  <div className="sm:col-span-2">
                    <TagInput
                      label="Máquinas e Equipamentos"
                      value={setor.maquinas_equipamentos}
                      disabled={!canEdit}
                      onChange={(v) => updateSetor(setor.id, { maquinas_equipamentos: v })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Descrição da Atividade
                    </label>
                    <textarea
                      value={setor.descricao_atividade}
                      disabled={!canEdit}
                      rows={2}
                      onChange={(e) => updateSetor(setor.id, { descricao_atividade: e.target.value })}
                      className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none disabled:bg-gray-50"
                    />
                  </div>
                </div>

                {/* Tabela de riscos */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      Agentes / Riscos (Seção 9)
                    </h3>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => addRisco(setor.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <Plus className="size-3" /> Risco
                      </button>
                    )}
                  </div>

                  {setor.riscos.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Nenhum risco cadastrado.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-gray-200">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 text-gray-500">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Tipo</th>
                            <th className="px-3 py-2 text-left font-medium">Risco</th>
                            <th className="px-3 py-2 text-left font-medium">Intensidade</th>
                            <th className="px-3 py-2 text-left font-medium">Técnica</th>
                            <th className="px-3 py-2 text-left font-medium">EPI CA</th>
                            <th className="px-3 py-2 text-left font-medium">EPI Eficaz</th>
                            <th className="px-3 py-2 text-center font-medium">Classificação</th>
                            {canEdit && <th className="px-3 py-2" />}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {setor.riscos.map((risco) => (
                            <tr key={risco.id}>
                              <td className="px-3 py-1.5">
                                <select
                                  value={risco.tipo}
                                  disabled={!canEdit}
                                  onChange={(e) => updateRisco(setor.id, risco.id, { tipo: e.target.value as TipoRiscoAET })}
                                  className="rounded border border-gray-300 bg-white px-1.5 py-1 text-xs disabled:bg-gray-50"
                                >
                                  {TIPOS_RISCO.map((t) => <option key={t}>{t}</option>)}
                                </select>
                              </td>
                              <td className="px-3 py-1.5">
                                <input
                                  type="text"
                                  value={risco.risco}
                                  disabled={!canEdit}
                                  onChange={(e) => updateRisco(setor.id, risco.id, { risco: e.target.value })}
                                  className="w-36 rounded border border-gray-300 px-1.5 py-1 text-xs disabled:bg-gray-50"
                                />
                              </td>
                              <td className="px-3 py-1.5">
                                <input
                                  type="text"
                                  value={risco.intensidade_concentracao}
                                  disabled={!canEdit}
                                  onChange={(e) => updateRisco(setor.id, risco.id, { intensidade_concentracao: e.target.value })}
                                  className="w-20 rounded border border-gray-300 px-1.5 py-1 text-xs disabled:bg-gray-50"
                                />
                              </td>
                              <td className="px-3 py-1.5">
                                <input
                                  type="text"
                                  value={risco.tecnica_metodologia}
                                  disabled={!canEdit}
                                  onChange={(e) => updateRisco(setor.id, risco.id, { tecnica_metodologia: e.target.value })}
                                  className="w-24 rounded border border-gray-300 px-1.5 py-1 text-xs disabled:bg-gray-50"
                                />
                              </td>
                              <td className="px-3 py-1.5">
                                <input
                                  type="text"
                                  value={risco.epi_ca}
                                  disabled={!canEdit}
                                  onChange={(e) => updateRisco(setor.id, risco.id, { epi_ca: e.target.value })}
                                  className="w-16 rounded border border-gray-300 px-1.5 py-1 text-xs disabled:bg-gray-50"
                                />
                              </td>
                              <td className="px-3 py-1.5">
                                <input
                                  type="text"
                                  value={risco.epi_eficaz}
                                  disabled={!canEdit}
                                  onChange={(e) => updateRisco(setor.id, risco.id, { epi_eficaz: e.target.value })}
                                  className="w-24 rounded border border-gray-300 px-1.5 py-1 text-xs disabled:bg-gray-50"
                                />
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                <select
                                  value={risco.classificacao_risco}
                                  disabled={!canEdit}
                                  onChange={(e) => updateRisco(setor.id, risco.id, { classificacao_risco: e.target.value as ClassificacaoRiscoAET })}
                                  className={cn(
                                    "rounded border px-1.5 py-1 text-xs font-medium",
                                    CLASS_COLOR[risco.classificacao_risco]
                                  )}
                                >
                                  {CLASSIFICACOES.map((c) => <option key={c}>{c}</option>)}
                                </select>
                              </td>
                              {canEdit && (
                                <td className="px-3 py-1.5">
                                  <button
                                    type="button"
                                    onClick={() => removeRisco(setor.id, risco.id)}
                                    className="text-red-400 hover:text-red-600"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function TextInput({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-verde-primary focus:outline-none disabled:bg-gray-50"
      />
    </div>
  );
}

function TagInput({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  const items = value ? value.split("\n").filter((s) => s.trim().length > 0) : [];
  const [input, setInput] = useState("");

  function addItem(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed || items.includes(trimmed)) return;
    onChange([...items, trimmed].join("\n"));
    setInput("");
  }

  function removeItem(idx: number) {
    onChange(items.filter((_, i) => i !== idx).join("\n"));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addItem(input);
    } else if (e.key === "Backspace" && !input && items.length > 0) {
      removeItem(items.length - 1);
    }
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <div
        className={cn(
          "flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-md border border-gray-300 px-2 py-1.5 focus-within:border-verde-primary focus-within:ring-2 focus-within:ring-verde-primary/20",
          disabled && "bg-gray-50"
        )}
      >
        {items.map((item, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 rounded-full bg-verde-light px-2.5 py-0.5 text-xs font-medium text-verde-primary"
          >
            {item}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="text-verde-primary/50 hover:text-verde-primary"
              >
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => { if (input.trim()) addItem(input); }}
            className="flex-1 min-w-[100px] bg-transparent text-sm outline-none placeholder:text-gray-400"
            placeholder={items.length === 0 ? "Digite e pressione Enter..." : "+"}
          />
        )}
      </div>
    </div>
  );
}
