"use client";

import { useEffect, useState, use } from "react";
import { Save, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";
import {
  useAetOwasConfig,
  useAetOwasSelects,
  useAetChecklistPerguntas,
  useAetPerfisOwas,
  useAetRelatorio,
  useSalvarAet,
  SLUG_TO_DEFAULT_IMAGE,
  SLUG_TO_OWAS_FIELD,
} from "@/lib/hooks/useAet";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import RichTextEditor from "@/components/drps/RichTextEditor";
import { cn } from "@/lib/utils";
import type { AetOwas, AetOwasCategoria, AetSetor, AetChecklist, RespostaChecklist } from "@/lib/supabase/types";

export default function AetAnalisePage({
  params,
}: {
  params: Promise<{ idRelatorio: string }>;
}) {
  const { idRelatorio } = use(params);
  const { data: rel, isLoading } = useAetRelatorio(idRelatorio);
  const salvar = useSalvarAet();
  const canEdit = useCanEdit();
  const { data: owasConfig = [] } = useAetOwasConfig();
  const { data: perfisOwas = [] } = useAetPerfisOwas();
  const { data: owasSelects = [] } = useAetOwasSelects();
  const { data: checklistPerguntas = [] } = useAetChecklistPerguntas();

  const selectOpts = (slug: string): string[] =>
    owasSelects.find((s) => s.slug === slug)?.opcoes ?? [];

  const pergunta = (slug: string) =>
    checklistPerguntas.find((p) => p.slug === slug)?.label ?? "";

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

  function updateSetor(id: string, patch: Partial<AetSetor>) {
    setSetores((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function toggleOwas(
    setorId: string,
    field: keyof AetOwas,
    value: number
  ) {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor) return;
    const current = setor.owas[field] as number[];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateSetor(setorId, { owas: { ...setor.owas, [field]: next } as AetOwas });
  }

  function updateChecklist(setorId: string, patch: Partial<AetChecklist>) {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor) return;
    updateSetor(setorId, { checklist: { ...setor.checklist, ...patch } });
  }

  function aplicarPerfil(setorId: string, perfilId: string) {
    const perfil = perfisOwas.find((p) => p.id === perfilId);
    if (!perfil) return;
    updateSetor(setorId, {
      owas: {
        posturas_costas: perfil.posturas_costas,
        posturas_bracos: perfil.posturas_bracos,
        posturas_pernas: perfil.posturas_pernas,
        esforco: perfil.esforco,
      },
    });
  }

  function handleSave() {
    salvar.mutate(
      { id: idRelatorio, patch: { setores } },
      {
        onSuccess: () => toast.success("Análise salva"),
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

  if (setores.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
        Nenhum setor cadastrado. Adicione setores na aba{" "}
        <strong>Setores / Riscos</strong> primeiro.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">OWAS / Checklist</h1>
          <p className="text-xs text-gray-500">Seção 13 — análise ergonômica por setor/função</p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={handleSave}
            disabled={salvar.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
          >
            {salvar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Salvar
          </button>
        )}
      </div>

      {setores.map((setor, idx) => (
        <div key={setor.id} className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => toggle(setor.id)}
            className="flex w-full items-center justify-between px-5 py-3 text-left"
          >
            <span className="font-semibold text-gray-900">
              Setor {idx + 1}: {setor.nome_setor || <span className="italic text-gray-400">Sem nome</span>}
              {setor.cargos.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  — {setor.cargos.map((c) => c.nome).filter(Boolean).join(", ")}
                </span>
              )}
            </span>
            {abertos.has(setor.id) ? (
              <ChevronUp className="size-4 text-gray-400" />
            ) : (
              <ChevronDown className="size-4 text-gray-400" />
            )}
          </button>

          {abertos.has(setor.id) && (
            <div className="space-y-6 border-t border-gray-100 px-5 pb-6 pt-4">
              {/* Aplicar perfil */}
              {canEdit && perfisOwas.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Aplicar perfil OWAS:</span>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) aplicarPerfil(setor.id, e.target.value);
                      e.target.value = "";
                    }}
                    className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 focus:border-verde-primary focus:outline-none"
                  >
                    <option value="" disabled>Selecionar perfil...</option>
                    {perfisOwas.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                  <span className="text-[10px] text-gray-400">Preenche os campos OWAS abaixo</span>
                </div>
              )}

              {/* OWAS */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {owasConfig.map((cat) => {
                  const field = SLUG_TO_OWAS_FIELD[cat.slug];
                  if (!field) return null;
                  return (
                    <OwasGroup
                      key={cat.id}
                      categoria={cat}
                      selected={(setor.owas[field] ?? []) as number[]}
                      disabled={!canEdit}
                      onToggle={(v) => toggleOwas(setor.id, field, v)}
                    />
                  );
                })}
              </div>

              {/* Checklist */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Postura / Organização do Trabalho
                  </h3>
                  <div className="flex gap-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider pr-1">
                    <span className="w-7 text-center">Sim</span>
                    <span className="w-7 text-center">Não</span>
                    <span className="w-7 text-center">N/A</span>
                  </div>
                </div>

                <TriStateRow
                  label={pergunta("levantamento_acima_limite")}
                  value={setor.checklist.levantamento_acima_limite}
                  disabled={!canEdit}
                  onChange={(v) => updateChecklist(setor.id, { levantamento_acima_limite: v })}
                />

                <div className="flex items-start gap-3">
                  <span className="flex-1 text-xs text-gray-700">{owasSelects.find(s => s.slug === "trabalho_predominante")?.label ?? "O trabalho executado durante aos chamados decorrentes do dia-dia, são realizados preponderantemente de qual forma?"}</span>
                  <select
                    value={setor.checklist.trabalho_predominante}
                    disabled={!canEdit}
                    onChange={(e) =>
                      updateChecklist(setor.id, {
                        trabalho_predominante: e.target.value as AetChecklist["trabalho_predominante"],
                      })
                    }
                    className="rounded border border-gray-300 bg-white px-2 py-1 text-xs disabled:bg-gray-50"
                  >
                    {selectOpts("trabalho_predominante").map((o) => <option key={o}>{o}</option>)}
                  </select>
                </div>

                <TriStateRow label={pergunta("pausas_descanso")} value={setor.checklist.pausas_descanso} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { pausas_descanso: v })} />
                <TriStateRow label={pergunta("uso_cadeira")} value={setor.checklist.uso_cadeira} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { uso_cadeira: v })} />
                <TriStateRow label={pergunta("cadeira_adequada")} value={setor.checklist.cadeira_adequada} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { cadeira_adequada: v })} />
                <TriStateRow label={pergunta("monitor")} value={setor.checklist.monitor} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { monitor: v })} />

                <div className="mt-1 border-t border-gray-200 pt-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Exigência de Tempo</p>
                  <TriStateRow label={pergunta("exigencia_levantamento")} value={setor.checklist.exigencia_levantamento} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { exigencia_levantamento: v })} />
                </div>

                <div className="border-t border-gray-200 pt-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Ritmo de Trabalho</p>
                  <TriStateRow label={pergunta("ritmo_por_demanda")} value={setor.checklist.ritmo_por_demanda} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { ritmo_por_demanda: v })} />
                </div>

                <div className="border-t border-gray-200 pt-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Adoção de Rodízios — Ergonômico</p>
                  <TriStateRow label={pergunta("pausas_formais")} value={setor.checklist.pausas_formais} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { pausas_formais: v })} />
                  <div className="mt-2">
                    <TriStateRow label={pergunta("rodizios_sistematizados")} value={setor.checklist.rodizios_sistematizados} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { rodizios_sistematizados: v })} />
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-3">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Organização do Trabalho</p>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {checklistPerguntas.find(p => p.slug === "organizacao_trabalho")?.label ?? "As normas de produção contemplando equipamentos, modo operatório, aspectos de segurança e qualidade deverão estar descritos nas instruções internas de trabalho, elaboradas pela empresa."}
                  </p>
                </div>
              </div>

              {/* Recomendações */}
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">
                    Parecer Técnico
                  </label>
                  <RichTextEditor
                    value={setor.parecer_tecnico}
                    onChange={(html) => updateSetor(setor.id, { parecer_tecnico: html })}
                    onBlur={() => {}}
                    readOnly={!canEdit}
                    uploadPathPrefix="aet-analise"
                    placeholder="Descreva o parecer técnico para este setor..."
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">
                    Recomendações
                  </label>
                  <RichTextEditor
                    value={setor.recomendacoes}
                    onChange={(html) => updateSetor(setor.id, { recomendacoes: html })}
                    onBlur={() => {}}
                    readOnly={!canEdit}
                    uploadPathPrefix="aet-analise"
                    placeholder="Liste as recomendações para este setor..."
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">
                    Demais Condições Avaliadas
                  </label>
                  <RichTextEditor
                    value={setor.demais_condicoes}
                    onChange={(html) => updateSetor(setor.id, { demais_condicoes: html })}
                    onBlur={() => {}}
                    readOnly={!canEdit}
                    uploadPathPrefix="aet-analise"
                    placeholder="Descreva demais condições avaliadas..."
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function OwasGroup({
  categoria,
  selected,
  disabled,
  onToggle,
}: {
  categoria: AetOwasCategoria;
  selected: number[];
  disabled: boolean;
  onToggle: (v: number) => void;
}) {
  const imageSrc = categoria.imagem_url ?? SLUG_TO_DEFAULT_IMAGE[categoria.slug];
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
      <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">
        {categoria.titulo}
      </h4>
      <div className="flex gap-3">
        <div className="flex-1 space-y-1.5">
          {categoria.opcoes.map((opt) => (
            <label
              key={opt.value}
              className={cn(
                "flex items-center gap-2 text-xs text-gray-700",
                disabled && "cursor-not-allowed opacity-60"
              )}
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                disabled={disabled}
                onChange={() => onToggle(opt.value)}
                className="size-3.5 rounded border-gray-300 text-verde-primary focus:ring-verde-primary"
              />
              {opt.label}
            </label>
          ))}
        </div>
        {imageSrc && (
          <div className="w-36 shrink-0 self-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc}
              alt={`Referência OWAS: ${categoria.titulo}`}
              className="h-auto w-full rounded border border-gray-200"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function TriStateRow({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: RespostaChecklist;
  disabled: boolean;
  onChange: (v: RespostaChecklist) => void;
}) {
  const opts: { v: RespostaChecklist; label: string }[] = [
    { v: "sim", label: "Sim" },
    { v: "nao", label: "Não" },
    { v: "nao_aplica", label: "N/A" },
  ];
  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-xs text-gray-700">{label}</span>
      <div className="flex shrink-0 gap-1">
        {opts.map(({ v, label: lbl }) => (
          <button
            key={v}
            type="button"
            disabled={disabled}
            onClick={() => onChange(v)}
            className={cn(
              "w-7 rounded py-0.5 text-[11px] font-semibold transition-colors",
              value === v
                ? v === "sim"
                  ? "bg-green-100 text-green-700 ring-1 ring-green-400"
                  : v === "nao"
                  ? "bg-red-100 text-red-700 ring-1 ring-red-400"
                  : "bg-gray-200 text-gray-500 ring-1 ring-gray-400"
                : "bg-white text-gray-300 ring-1 ring-gray-200 hover:bg-gray-50",
              disabled && "cursor-not-allowed opacity-60"
            )}
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );
}
