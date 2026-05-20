"use client";

import { useEffect, useState, use } from "react";
import { Save, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";
import { useAetRelatorio, useSalvarAet } from "@/lib/hooks/useAet";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import RichTextEditor from "@/components/drps/RichTextEditor";
import { cn } from "@/lib/utils";
import type {
  AetSetor,
  AetChecklist,
  PosturaCostas,
  PosturaBracos,
  PosturaPernas,
  EsforcoOWAS,
} from "@/lib/supabase/types";

const OWAS_IMAGE: Record<string, string> = {
  "Postura das Costas": "/owas/costas.svg",
  "Postura dos Braços": "/owas/bracos.svg",
  "Postura das Pernas": "/owas/pernas.svg",
  "Esforço": "/owas/esforco.svg",
};

// ─── OWAS options ─────────────────────────────────────────────────────────────

const COSTAS: { value: PosturaCostas; label: string }[] = [
  { value: 1, label: "1 – Ereta" },
  { value: 2, label: "2 – Inclinada" },
  { value: 3, label: "3 – Ereta e Torcida" },
  { value: 4, label: "4 – Inclinada e Torcida" },
];
const BRACOS: { value: PosturaBracos; label: string }[] = [
  { value: 1, label: "1 – Os dois braços abaixo dos ombros" },
  { value: 2, label: "2 – Um braço no nível ou acima dos ombros" },
  { value: 3, label: "3 – Ambos braços no nível ou acima dos ombros" },
];
const PERNAS: { value: PosturaPernas; label: string }[] = [
  { value: 1, label: "1 – Sentado" },
  { value: 2, label: "2 – De pé com ambas as pernas esticadas" },
  { value: 3, label: "3 – De pé com o peso de uma das pernas esticada" },
  { value: 4, label: "4 – De pé ou agachado com ambos os joelhos flexionados" },
  { value: 5, label: "5 – De pé ou agachado com um dos joelhos dobrados" },
  { value: 6, label: "6 – Ajoelhado em um ou ambos os joelhos" },
  { value: 7, label: "7 – Andando ou se movendo" },
];
const ESFORCO: { value: EsforcoOWAS; label: string }[] = [
  { value: 1, label: "1 – Carga ≤ 10 kg" },
  { value: 2, label: "2 – Carga > 10 kg e ≤ 20 kg" },
  { value: 3, label: "3 – Carga > 20 kg" },
];

export default function AetAnalisePage({
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

  function updateSetor(id: string, patch: Partial<AetSetor>) {
    setSetores((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function toggleOwas<T extends number>(
    setorId: string,
    field: "posturas_costas" | "posturas_bracos" | "posturas_pernas" | "esforco",
    value: T
  ) {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor) return;
    const current = setor.owas[field] as T[];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateSetor(setorId, { owas: { ...setor.owas, [field]: next } });
  }

  function updateChecklist(setorId: string, patch: Partial<AetChecklist>) {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor) return;
    updateSetor(setorId, { checklist: { ...setor.checklist, ...patch } });
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
            {abertos.has(setor.id) ? <ChevronUp className="size-4 text-gray-400" /> : <ChevronDown className="size-4 text-gray-400" />}
          </button>

          {abertos.has(setor.id) && (
            <div className="border-t border-gray-100 px-5 pb-6 pt-4 space-y-6">
              {/* OWAS */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <OwasGroup
                  title="Postura das Costas"
                  options={COSTAS}
                  selected={setor.owas.posturas_costas}
                  disabled={!canEdit}
                  onToggle={(v) => toggleOwas(setor.id, "posturas_costas", v as PosturaCostas)}
                />
                <OwasGroup
                  title="Postura dos Braços"
                  options={BRACOS}
                  selected={setor.owas.posturas_bracos}
                  disabled={!canEdit}
                  onToggle={(v) => toggleOwas(setor.id, "posturas_bracos", v as PosturaBracos)}
                />
                <OwasGroup
                  title="Postura das Pernas"
                  options={PERNAS}
                  selected={setor.owas.posturas_pernas}
                  disabled={!canEdit}
                  onToggle={(v) => toggleOwas(setor.id, "posturas_pernas", v as PosturaPernas)}
                />
                <OwasGroup
                  title="Esforço"
                  options={ESFORCO}
                  selected={setor.owas.esforco}
                  disabled={!canEdit}
                  onToggle={(v) => toggleOwas(setor.id, "esforco", v as EsforcoOWAS)}
                />
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
                    {["Ocasionais", "Eventuais", "Habituais", "Não Aplica"].map((o) => (
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
                    {["Em pé", "Sentado", "Alternando"].map((o) => <option key={o}>{o}</option>)}
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
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">
                    Parecer Técnico / Recomendações (Seção 13)
                  </label>
                  <RichTextEditor
                    value={setor.parecer_tecnico}
                    onChange={(html) => updateSetor(setor.id, { parecer_tecnico: html })}
                    onBlur={() => {/* auto-save not needed, use Save button */}}
                    readOnly={!canEdit}
                    uploadPathPrefix="aet-analise"
                    placeholder="Descreva o parecer técnico e as recomendações para este setor..."
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

// ─── Sub-components ──────────────────────────────────────────────────────────

function OwasGroup({
  title,
  options,
  selected,
  disabled,
  onToggle,
}: {
  title: string;
  options: { value: number; label: string }[];
  selected: number[];
  disabled: boolean;
  onToggle: (v: number) => void;
}) {
  const imageSrc = OWAS_IMAGE[title];
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
      <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">{title}</h4>
      <div className="flex gap-3">
        <div className="flex-1 space-y-1.5">
          {options.map((opt) => (
            <label key={opt.value} className={cn("flex items-center gap-2 text-xs text-gray-700", disabled && "cursor-not-allowed opacity-60")}>
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
          <div className="shrink-0 w-36 self-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc}
              alt={`Referência OWAS: ${title}`}
              className="w-full h-auto rounded border border-gray-200"
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
    <label className={cn("flex items-center gap-2 text-xs text-gray-700", disabled && "cursor-not-allowed opacity-60")}>
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
