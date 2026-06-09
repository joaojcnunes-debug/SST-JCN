"use client";

import { use, useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, Plus, Save, Trash2 } from "lucide-react";
import {
  useAepRelatorio,
  useSalvarAep,
  setorVazioAep,
  riscoVazioAep,
  calcNecessitaAet,
  CLASS_COLOR_AEP,
  TIPOS_RISCO_AEP,
  CLASSIFICACOES_AEP,
} from "@/lib/hooks/useAep";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import { cn } from "@/lib/utils";
import type {
  AepCargoSetor,
  AepSetor,
  AepRisco,
  AepChecklistFisica,
  AepChecklistCognitiva,
  AepChecklistOrganizacional,
  ClassificacaoRiscoAET,
  RespostaChecklist,
  TipoRiscoAET,
} from "@/lib/supabase/types";

// ─── Tristate ─────────────────────────────────────────────────────────────────

function Tristate({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: RespostaChecklist;
  onChange: (v: RespostaChecklist) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <span className="text-xs text-gray-700">{label}</span>
      <div className="flex gap-1 shrink-0">
        {(["sim", "nao", "nao_aplica"] as RespostaChecklist[]).map((opt) => (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt)}
            className={cn(
              "rounded px-2 py-0.5 text-[10px] font-semibold transition",
              value === opt
                ? opt === "sim"
                  ? "bg-red-500 text-white"
                  : opt === "nao"
                  ? "bg-green-500 text-white"
                  : "bg-gray-400 text-white"
                : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-100"
            )}
          >
            {opt === "sim" ? "Sim" : opt === "nao" ? "Não" : "N/A"}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Bloco de checklist ───────────────────────────────────────────────────────

function ChecklistBloco({
  titulo,
  cor,
  itens,
  valores,
  onChange,
  disabled,
}: {
  titulo: string;
  cor: string;
  itens: { key: string; label: string }[];
  valores: Record<string, RespostaChecklist>;
  onChange: (patch: Record<string, RespostaChecklist>) => void;
  disabled?: boolean;
}) {
  const positivos = itens.filter((i) => valores[i.key] === "sim").length;
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className={cn("px-4 py-2.5 font-semibold text-sm flex items-center justify-between", cor)}>
        <span>{titulo}</span>
        {positivos > 0 && (
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold text-red-600">
            {positivos} alerta{positivos > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="divide-y divide-gray-100 p-2 space-y-1">
        {itens.map(({ key, label }) => (
          <Tristate
            key={key}
            label={label}
            value={valores[key]}
            onChange={(v) => onChange({ [key]: v })}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Itens dos checklists ─────────────────────────────────────────────────────

const ITENS_FISICA: { key: keyof AepChecklistFisica; label: string }[] = [
  { key: "postura",             label: "Posturas inadequadas / forçadas" },
  { key: "repetitividade",      label: "Movimentos repetitivos" },
  { key: "levantamento_carga",  label: "Levantamento / transporte de cargas" },
  { key: "mobiliario",          label: "Mobiliário inadequado" },
  { key: "esforco_fisico",      label: "Esforço físico elevado" },
  { key: "iluminacao",          label: "Iluminação inadequada" },
  { key: "ruido",               label: "Ruído / ambiente sonoro adverso" },
  { key: "vibracao",            label: "Vibração (corpo inteiro / mãos e braços)" },
  { key: "desconforto_termico", label: "Desconforto térmico" },
];

const ITENS_COGNITIVA: { key: keyof AepChecklistCognitiva; label: string }[] = [
  { key: "atencao_continua",    label: "Atenção contínua / concentração elevada" },
  { key: "sobrecarga_mental",   label: "Sobrecarga mental / complexidade da tarefa" },
  { key: "pressao_psicologica", label: "Pressão psicológica / cobrança excessiva" },
  { key: "excesso_informacoes", label: "Excesso de informações simultâneas" },
  { key: "ritmo_mental",        label: "Ritmo mental acelerado" },
];

const ITENS_ORGANIZACIONAL: { key: keyof AepChecklistOrganizacional; label: string }[] = [
  { key: "assedio",               label: "Assédio de qualquer natureza no trabalho" },
  { key: "falta_suporte",         label: "Falta de suporte / apoio no trabalho" },
  { key: "gestao_mudancas",       label: "Má gestão de mudanças organizacionais" },
  { key: "clareza_papel",         label: "Baixa clareza de papel / função" },
  { key: "recompensas",           label: "Baixas recompensas e reconhecimento" },
  { key: "baixo_controle",        label: "Baixo controle no trabalho / Falta de autonomia" },
  { key: "justica_organizacional",label: "Baixa justiça organizacional" },
  { key: "eventos_traumaticos",   label: "Eventos violentos ou traumáticos" },
  { key: "subcarga",              label: "Baixa demanda no trabalho (Subcarga)" },
  { key: "sobrecarga",            label: "Excesso de demandas no trabalho (Sobrecarga)" },
  { key: "maus_relacionamentos",  label: "Maus relacionamentos no local de trabalho" },
  { key: "comunicacao_dificil",   label: "Trabalho em condições de difícil comunicação" },
  { key: "trabalho_remoto",       label: "Trabalho remoto e isolado" },
];

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AepSetoresPage({
  params,
}: {
  params: Promise<{ idRelatorio: string }>;
}) {
  const { idRelatorio } = use(params);
  const { data: rel, isLoading } = useAepRelatorio(idRelatorio);
  const salvar = useSalvarAep();
  const canEdit = useCanEdit();

  const [setores, setSetores] = useState<AepSetor[]>([]);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);

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
    const novo = setorVazioAep();
    setSetores((s) => [...s, novo]);
    setAbertos((prev) => new Set([...prev, novo.id]));
  }

  function removeSetor(id: string) {
    setSetores((s) => s.filter((x) => x.id !== id));
  }

  function updateSetor(id: string, patch: Partial<AepSetor>) {
    setSetores((s) =>
      s.map((x) => {
        if (x.id !== id) return x;
        const updated = { ...x, ...patch };
        updated.necessita_aet = calcNecessitaAet(updated);
        return updated;
      })
    );
  }

  function addRisco(setorId: string) {
    const novo = riscoVazioAep();
    updateSetor(setorId, {
      riscos: [...(setores.find((s) => s.id === setorId)?.riscos ?? []), novo],
    });
  }

  function updateRisco(setorId: string, riscoId: string, patch: Partial<AepRisco>) {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor) return;
    updateSetor(setorId, {
      riscos: setor.riscos.map((r) => (r.id === riscoId ? { ...r, ...patch } : r)),
    });
  }

  function removeRisco(setorId: string, riscoId: string) {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor) return;
    updateSetor(setorId, { riscos: setor.riscos.filter((r) => r.id !== riscoId) });
  }

  function buildTrabalhadores(cargos: AepCargoSetor[]): string {
    return cargos
      .filter((c) => c.cargo)
      .map((c) => c.quantidade > 0 ? `${c.quantidade} ${c.cargo}` : c.cargo)
      .join(", ");
  }

  function addCargo(setorId: string) {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor) return;
    const novo: AepCargoSetor = { id: crypto.randomUUID(), cargo: "", descricao: "", quantidade: 0 };
    const novos = [...(setor.cargos ?? []), novo];
    updateSetor(setorId, {
      cargos: novos,
      funcao: novos.map((c) => c.cargo).filter(Boolean).join(", "),
      trabalhadores_consultados: buildTrabalhadores(novos),
    });
  }

  function updateCargo(setorId: string, cargoId: string, patch: Partial<AepCargoSetor>) {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor) return;
    const novos = (setor.cargos ?? []).map((c) => (c.id === cargoId ? { ...c, ...patch } : c));
    const syncCargo = "cargo" in patch;
    const syncQtd = "quantidade" in patch || syncCargo;
    updateSetor(setorId, {
      cargos: novos,
      ...(syncCargo && { funcao: novos.map((c) => c.cargo).filter(Boolean).join(", ") }),
      ...(syncQtd && { trabalhadores_consultados: buildTrabalhadores(novos) }),
    });
  }

  function removeCargo(setorId: string, cargoId: string) {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor) return;
    const novos = (setor.cargos ?? []).filter((c) => c.id !== cargoId);
    updateSetor(setorId, {
      cargos: novos,
      funcao: novos.map((c) => c.cargo).filter(Boolean).join(", "),
      trabalhadores_consultados: buildTrabalhadores(novos),
    });
  }

  async function handleSalvar() {
    setSalvando(true);
    try {
      await salvar.mutateAsync({ id: idRelatorio, setores: setores as unknown as AepSetor[] });
    } catch {
      // erro já tratado pelo hook
    } finally {
      setSalvando(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  const empresa = rel?.empresas as { nome_empresa?: string } | null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Setores / Triagem Ergonômica</h1>
          <p className="text-sm text-gray-500">{empresa?.nome_empresa}</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addSetor}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              <Plus className="size-4" /> Adicionar setor
            </button>
            <button
              type="button"
              onClick={handleSalvar}
              disabled={salvando}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
            >
              {salvando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Salvar
            </button>
          </div>
        )}
      </div>

      {setores.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
          <p className="text-sm text-gray-500">Nenhum setor cadastrado.</p>
          {canEdit && (
            <button
              onClick={addSetor}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
            >
              <Plus className="size-4" /> Adicionar setor
            </button>
          )}
        </div>
      )}

      {setores.map((setor, idx) => {
        const open = abertos.has(setor.id);
        const aletaFisica = Object.values(setor.checklist_fisica).filter((v) => v === "sim").length;
        const alertaCog = Object.values(setor.checklist_cognitiva).filter((v) => v === "sim").length;
        const alertaOrg = Object.values(setor.checklist_organizacional).filter((v) => v === "sim").length;
        const totalAlertas = aletaFisica + alertaCog + alertaOrg;

        return (
          <div key={setor.id} className="rounded-xl border border-gray-200 bg-white shadow-sm">
            {/* Header */}
            <div
              className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50"
              onClick={() => toggle(setor.id)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="shrink-0 flex size-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {setor.nome_setor || "Setor sem nome"}
                  </p>
                  {setor.cargo && <p className="text-xs text-gray-500 truncate">{setor.cargo}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {setor.necessita_aet && (
                  <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                    <AlertTriangle className="size-3" /> AET
                  </span>
                )}
                {totalAlertas > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                    {totalAlertas} alerta{totalAlertas > 1 ? "s" : ""}
                  </span>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeSetor(setor.id); }}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
                {open ? <ChevronUp className="size-4 text-gray-400" /> : <ChevronDown className="size-4 text-gray-400" />}
              </div>
            </div>

            {open && (
              <div className="border-t border-gray-100 p-4 space-y-5">

                {/* ── Identificação ─────────────────────────────────── */}
                <section>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Identificação
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      { key: "nome_setor", label: "Setor *",  placeholder: "Nome do setor" },
                      { key: "unidade",    label: "Unidade",  placeholder: "Unidade / filial" },
                      { key: "ghe",        label: "GHE",      placeholder: "Grupo Homogêneo de Exposição" },
                      { key: "jornada",    label: "Jornada",  placeholder: "Ex: 8h/dia, 44h/semana" },
                    ].map(({ key, label, placeholder }) => (
                      <div key={key}>
                        <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
                        <input
                          type="text"
                          disabled={!canEdit}
                          value={(setor as unknown as Record<string, unknown>)[key] as string ?? ""}
                          onChange={(e) => updateSetor(setor.id, { [key]: e.target.value })}
                          placeholder={placeholder}
                          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50"
                        />
                      </div>
                    ))}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Qtd. expostos</label>
                      <input
                        type="number"
                        min={0}
                        disabled={!canEdit}
                        value={setor.qtd_expostos || ""}
                        onChange={(e) => updateSetor(setor.id, { qtd_expostos: Number(e.target.value) })}
                        placeholder="0"
                        className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50"
                      />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-3">
                      <label className="mb-1 block text-xs font-medium text-gray-600">Função (preenchida automaticamente pelos cargos)</label>
                      <input
                        type="text"
                        disabled
                        value={setor.funcao ?? ""}
                        placeholder="Preenchida automaticamente pelos cargos"
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-500"
                      />
                    </div>
                  </div>

                  {/* Cargos */}
                  <div className="mt-3">
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-xs font-medium text-gray-600">Cargos</label>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => addCargo(setor.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          <Plus className="size-3" /> Adicionar cargo
                        </button>
                      )}
                    </div>
                    {(setor.cargos ?? []).length > 0 && (
                      <div className="space-y-2">
                        <div className="grid gap-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 px-1" style={{ gridTemplateColumns: "1fr 2fr 64px auto" }}>
                          <span>Cargo</span><span>Descrição</span><span className="text-center">Qtd</span><span />
                        </div>
                        {(setor.cargos ?? []).map((cargo) => (
                          <div key={cargo.id} className="grid items-center gap-2" style={{ gridTemplateColumns: "1fr 2fr 64px auto" }}>
                            <input
                              type="text"
                              disabled={!canEdit}
                              value={cargo.cargo}
                              onChange={(e) => updateCargo(setor.id, cargo.id, { cargo: e.target.value })}
                              placeholder="Ex: Operador"
                              className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50"
                            />
                            <input
                              type="text"
                              disabled={!canEdit}
                              value={cargo.descricao}
                              onChange={(e) => updateCargo(setor.id, cargo.id, { descricao: e.target.value })}
                              placeholder="Descrição da função"
                              className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50"
                            />
                            <input
                              type="number"
                              min={0}
                              disabled={!canEdit}
                              value={cargo.quantidade || ""}
                              onChange={(e) => updateCargo(setor.id, cargo.id, { quantidade: Number(e.target.value) })}
                              placeholder="0"
                              className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-center focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50"
                            />
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => removeCargo(setor.id, cargo.id)}
                                className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-medium text-gray-600">Descrição das atividades</label>
                    <textarea
                      disabled={!canEdit}
                      value={setor.descricao_atividade}
                      onChange={(e) => updateSetor(setor.id, { descricao_atividade: e.target.value })}
                      rows={2}
                      placeholder="Descreva as principais atividades realizadas..."
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50"
                    />
                  </div>

                  {/* Participação dos trabalhadores */}
                  <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      Participação dos trabalhadores — NR-1
                    </p>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Método de coleta de dados</label>
                      <MetodoColetaSelect
                        value={setor.metodo_coleta ?? ""}
                        onChange={(v) => updateSetor(setor.id, { metodo_coleta: v })}
                        disabled={!canEdit}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Trabalhadores consultados</label>
                      <input
                        type="text"
                        disabled={!canEdit}
                        value={setor.trabalhadores_consultados ?? ""}
                        onChange={(e) => updateSetor(setor.id, { trabalhadores_consultados: e.target.value })}
                        placeholder="Ex: 3 operador, 2 auxiliar"
                        className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50"
                      />
                    </div>
                  </div>
                </section>

                {/* ── Triagem Ergonômica ────────────────────────────── */}
                <section>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Triagem Ergonômica
                  </h3>
                  <div className="grid gap-3 lg:grid-cols-3">
                    <ChecklistBloco
                      titulo="Ergonomia Física"
                      cor="bg-blue-50 text-blue-800"
                      itens={ITENS_FISICA}
                      valores={setor.checklist_fisica as unknown as Record<string, RespostaChecklist>}
                      onChange={(p) => updateSetor(setor.id, { checklist_fisica: { ...setor.checklist_fisica, ...p } as AepChecklistFisica })}
                      disabled={!canEdit}
                    />
                    <ChecklistBloco
                      titulo="Ergonomia Cognitiva"
                      cor="bg-purple-50 text-purple-800"
                      itens={ITENS_COGNITIVA}
                      valores={setor.checklist_cognitiva as unknown as Record<string, RespostaChecklist>}
                      onChange={(p) => updateSetor(setor.id, { checklist_cognitiva: { ...setor.checklist_cognitiva, ...p } as AepChecklistCognitiva })}
                      disabled={!canEdit}
                    />
                    <ChecklistBloco
                      titulo="Ergonomia Organizacional"
                      cor="bg-amber-50 text-amber-800"
                      itens={ITENS_ORGANIZACIONAL}
                      valores={setor.checklist_organizacional as unknown as Record<string, RespostaChecklist>}
                      onChange={(p) => updateSetor(setor.id, { checklist_organizacional: { ...setor.checklist_organizacional, ...p } as AepChecklistOrganizacional })}
                      disabled={!canEdit}
                    />
                  </div>
                </section>

                {/* ── Matriz de Riscos ──────────────────────────────── */}
                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      Matriz de Riscos
                    </h3>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => addRisco(setor.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        <Plus className="size-3" /> Risco
                      </button>
                    )}
                  </div>

                  {setor.riscos.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Nenhum risco identificado.</p>
                  ) : (
                    <div className="space-y-2">
                      {setor.riscos.map((risco) => (
                        <div key={risco.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2 sm:grid-cols-[140px_1fr_160px_180px_auto]">
                          <select
                            disabled={!canEdit}
                            value={risco.tipo}
                            onChange={(e) => updateRisco(setor.id, risco.id, { tipo: e.target.value as TipoRiscoAET })}
                            className="rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none disabled:bg-gray-50"
                          >
                            {TIPOS_RISCO_AEP.map((t) => (
                              <option key={t}>{t}</option>
                            ))}
                          </select>
                          <input
                            disabled={!canEdit}
                            type="text"
                            value={risco.risco}
                            onChange={(e) => updateRisco(setor.id, risco.id, { risco: e.target.value })}
                            placeholder="Agente / risco"
                            className="rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none disabled:bg-gray-50"
                          />
                          <select
                            disabled={!canEdit}
                            value={risco.classificacao_risco}
                            onChange={(e) => updateRisco(setor.id, risco.id, { classificacao_risco: e.target.value as ClassificacaoRiscoAET })}
                            className={`rounded border px-2 py-1 text-xs font-semibold focus:outline-none disabled:bg-gray-50 ${CLASS_COLOR_AEP[risco.classificacao_risco]}`}
                          >
                            {CLASSIFICACOES_AEP.map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </select>
                          <input
                            disabled={!canEdit}
                            type="text"
                            value={risco.medida_preventiva}
                            onChange={(e) => updateRisco(setor.id, risco.id, { medida_preventiva: e.target.value })}
                            placeholder="Medida preventiva"
                            className="rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none disabled:bg-gray-50"
                          />
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => removeRisco(setor.id, risco.id)}
                              className="rounded p-1 text-gray-400 hover:text-red-500"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* ── Indicador AET ─────────────────────────────────── */}
                {setor.necessita_aet && (
                  <div className="flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 p-3">
                    <AlertTriangle className="size-4 shrink-0 text-orange-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-orange-800">
                        Este setor requer elaboração de AET completa
                      </p>
                      <p className="text-xs text-orange-700 mt-0.5">
                        Foram identificados riscos Alto ou Crítico, ou múltiplos riscos Moderados. Recomenda-se aprofundamento pela Análise Ergonômica do Trabalho (NR-17).
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Parecer e Recomendações ───────────────────────── */}
                <section className="grid gap-3 lg:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">Parecer Técnico Preliminar</label>
                    <textarea
                      disabled={!canEdit}
                      value={setor.parecer_tecnico}
                      onChange={(e) => updateSetor(setor.id, { parecer_tecnico: e.target.value })}
                      rows={4}
                      placeholder="Descreva o parecer técnico preliminar para este setor..."
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">Recomendações</label>
                    <textarea
                      disabled={!canEdit}
                      value={setor.recomendacoes}
                      onChange={(e) => updateSetor(setor.id, { recomendacoes: e.target.value })}
                      rows={4}
                      placeholder="Liste as recomendações ergonômicas preliminares..."
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50"
                    />
                  </div>
                </section>

              </div>
            )}
          </div>
        );
      })}

      {setores.length > 0 && canEdit && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSalvar}
            disabled={salvando}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
          >
            {salvando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Salvar tudo
          </button>
        </div>
      )}
    </div>
  );
}

const METODOS_COLETA = [
  "Observação direta",
  "Entrevista individual",
  "Entrevista coletiva",
  "Questionário",
  "Análise documental",
  "Filmagem / fotografia",
  "Medição ambiental",
];

function MetodoColetaSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selecionados = value ? value.split(";").map((s) => s.trim()).filter(Boolean) : [];

  function toggle(metodo: string) {
    const set = new Set(selecionados);
    if (set.has(metodo)) set.delete(metodo);
    else set.add(metodo);
    onChange(Array.from(set).join("; "));
  }

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-left text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50 disabled:text-gray-500"
      >
        {selecionados.length === 0
          ? <span className="text-gray-400">Selecione os métodos...</span>
          : <span className="truncate">{selecionados.join("; ")}</span>
        }
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {METODOS_COLETA.map((m) => (
            <label key={m} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50">
              <input
                type="checkbox"
                checked={selecionados.includes(m)}
                onChange={() => toggle(m)}
                className="accent-emerald-600"
              />
              {m}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
