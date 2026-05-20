"use client";

import { useEffect, useState, use } from "react";
import { Save, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";
import {
  useAetOwasConfig,
  useAetOwasSelects,
  useAetPerfisOwas,
  useAetRelatorio,
  useSalvarAet,
  SLUG_TO_DEFAULT_IMAGE,
  SLUG_TO_OWAS_FIELD,
} from "@/lib/hooks/useAet";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import RichTextEditor from "@/components/drps/RichTextEditor";
import { cn } from "@/lib/utils";
import type { AetOwas, AetOwasCategoria, AetSetor, AetChecklist } from "@/lib/supabase/types";

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

  const selectOpts = (slug: string): string[] =>
    owasSelects.find((s) => s.slug === slug)?.opcoes ?? [];

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
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Postura / Organização do Trabalho
                </h3>

                <CheckRow
                  label="Há levantamento, transporte ou descarga acima do limite recomendado?"
                  checked={setor.checklist.levantamento_acima_limite}
                  disabled={!canEdit}
                  onChange={(v) => updateChecklist(setor.id, { levantamento_acima_limite: v })}
                />

                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-700">Posturas forçadas ocorrem de que forma?</span>
                  <select
                    value={setor.checklist.posturas_forcadas_tipo}
                    disabled={!canEdit}
                    onChange={(e) =>
                      updateChecklist(setor.id, {
                        posturas_forcadas_tipo: e.target.value as AetChecklist["posturas_forcadas_tipo"],
                      })
                    }
                    className="rounded border border-gray-300 bg-white px-2 py-1 text-xs disabled:bg-gray-50"
                  >
                    {selectOpts("posturas_forcadas_tipo").map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-700">Trabalho executado predominantemente:</span>
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

                <CheckRow label="A empresa oferece pausas para descanso ou cadeiras semi-sentado?" checked={setor.checklist.pausas_descanso} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { pausas_descanso: v })} />
                <CheckRow label="É disponibilizado o uso de cadeira?" checked={setor.checklist.uso_cadeira} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { uso_cadeira: v })} />
                <CheckRow label="A cadeira é estofada, giratória, ajustável?" checked={setor.checklist.cadeira_adequada} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { cadeira_adequada: v })} />
                <CheckRow label="A atividade usa monitor fixo com regulagem de altura?" checked={setor.checklist.monitor} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { monitor: v })} />
                <CheckRow label="Há levantamento acima do limite na exigência de tempo?" checked={setor.checklist.exigencia_levantamento} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { exigencia_levantamento: v })} />
                <CheckRow label="O ritmo de trabalho é determinado pela demanda?" checked={setor.checklist.ritmo_por_demanda} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { ritmo_por_demanda: v })} />
                <CheckRow label="Há pausas formais durante o ciclo de trabalho?" checked={setor.checklist.pausas_formais} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { pausas_formais: v })} />
                <CheckRow label="Há rodízios sistematizados entre os postos?" checked={setor.checklist.rodizios_sistematizados} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { rodizios_sistematizados: v })} />
              </div>

              {/* Parecer + Recomendações */}
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">
                  Parecer Técnico / Recomendações (Seção 13)
                </label>
                <RichTextEditor
                  value={setor.parecer_tecnico}
                  onChange={(html) => updateSetor(setor.id, { parecer_tecnico: html })}
                  onBlur={() => {/* save via button */}}
                  readOnly={!canEdit}
                  uploadPathPrefix="aet-analise"
                  placeholder="Descreva o parecer técnico e as recomendações para este setor..."
                />
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

function CheckRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-2 text-xs text-gray-700",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3.5 rounded border-gray-300 text-verde-primary focus:ring-verde-primary"
      />
      {label}
    </label>
  );
}
