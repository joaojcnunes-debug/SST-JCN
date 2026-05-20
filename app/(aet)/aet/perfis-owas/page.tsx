"use client";

import { useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  useAetPerfisOwas,
  useAetCriarPerfilOwas,
  useAetSalvarPerfilOwas,
  useAetExcluirPerfilOwas,
} from "@/lib/hooks/useAet";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { cn } from "@/lib/utils";
import type {
  AetPerfilOwas,
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

function perfilVazio(): Omit<AetPerfilOwas, "id" | "created_at"> {
  return {
    nome: "Novo Perfil",
    posturas_costas: [],
    posturas_bracos: [],
    posturas_pernas: [],
    esforco: [],
  };
}

export default function PerfisOwasPage() {
  const { data: perfis = [], isLoading } = useAetPerfisOwas();
  const criar = useAetCriarPerfilOwas();
  const excluir = useAetExcluirPerfilOwas();

  const [confirmExcluir, setConfirmExcluir] = useState<AetPerfilOwas | null>(null);

  function novoPerfil() {
    criar.mutate(perfilVazio(), {
      onSuccess: () => toast.success("Perfil criado"),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Perfis OWAS</h1>
          <p className="text-sm text-gray-600">
            Cadastre perfis de posturas OWAS reutilizáveis. Na análise de cada setor,
            selecione um perfil para preencher automaticamente os campos.
          </p>
        </div>
        <button
          type="button"
          onClick={novoPerfil}
          disabled={criar.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-verde-accent disabled:opacity-50"
        >
          {criar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Novo Perfil
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <LoadingSkeleton rows={3} />
        </div>
      ) : perfis.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
          Nenhum perfil cadastrado. Clique em <strong>Novo Perfil</strong> para começar.
        </div>
      ) : (
        <div className="space-y-4">
          {perfis.map((perfil) => (
            <PerfilCard
              key={perfil.id}
              perfil={perfil}
              onExcluir={() => setConfirmExcluir(perfil)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmExcluir}
        title="Excluir perfil?"
        description={
          confirmExcluir
            ? `O perfil "${confirmExcluir.nome}" será removido permanentemente.`
            : undefined
        }
        variant="danger"
        loading={excluir.isPending}
        onConfirm={() => {
          if (!confirmExcluir) return;
          excluir.mutate(confirmExcluir.id, {
            onSuccess: () => { setConfirmExcluir(null); toast.success("Perfil excluído"); },
          });
        }}
        onCancel={() => setConfirmExcluir(null)}
      />
    </div>
  );
}

// ─── PerfilCard ───────────────────────────────────────────────────────────────

function PerfilCard({
  perfil,
  onExcluir,
}: {
  perfil: AetPerfilOwas;
  onExcluir: () => void;
}) {
  const salvar = useAetSalvarPerfilOwas();

  const [nome, setNome] = useState(perfil.nome);
  const [costas, setCostas] = useState<PosturaCostas[]>(perfil.posturas_costas);
  const [bracos, setBracos] = useState<PosturaBracos[]>(perfil.posturas_bracos);
  const [pernas, setPernas] = useState<PosturaPernas[]>(perfil.posturas_pernas);
  const [esforco, setEsforco] = useState<EsforcoOWAS[]>(perfil.esforco);

  function toggleVal<T extends number>(
    current: T[],
    value: T,
    set: (v: T[]) => void
  ) {
    set(
      current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
    );
  }

  function handleSave() {
    salvar.mutate(
      {
        id: perfil.id,
        nome: nome.trim() || "Sem nome",
        posturas_costas: costas,
        posturas_bracos: bracos,
        posturas_pernas: pernas,
        esforco,
      },
      { onSuccess: () => toast.success("Perfil salvo") }
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome do perfil"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={salvar.isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-2 text-xs font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
        >
          {salvar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Salvar
        </button>
        <button
          type="button"
          onClick={onExcluir}
          className="rounded-md border border-gray-300 bg-white p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {/* OWAS checkboxes */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <OwasGroupConfig
          title="Postura das Costas"
          options={COSTAS}
          selected={costas}
          onToggle={(v) => toggleVal(costas, v as PosturaCostas, setCostas)}
        />
        <OwasGroupConfig
          title="Postura dos Braços"
          options={BRACOS}
          selected={bracos}
          onToggle={(v) => toggleVal(bracos, v as PosturaBracos, setBracos)}
        />
        <OwasGroupConfig
          title="Postura das Pernas"
          options={PERNAS}
          selected={pernas}
          onToggle={(v) => toggleVal(pernas, v as PosturaPernas, setPernas)}
        />
        <OwasGroupConfig
          title="Esforço"
          options={ESFORCO}
          selected={esforco}
          onToggle={(v) => toggleVal(esforco, v as EsforcoOWAS, setEsforco)}
        />
      </div>
    </div>
  );
}

// ─── OwasGroupConfig ──────────────────────────────────────────────────────────

function OwasGroupConfig({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: { value: number; label: string }[];
  selected: number[];
  onToggle: (v: number) => void;
}) {
  const imageSrc = OWAS_IMAGE[title];
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
      <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">{title}</h4>
      <div className="flex gap-3">
        <div className="flex-1 space-y-1.5">
          {options.map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => onToggle(opt.value)}
                className="size-3.5 rounded border-gray-300 text-verde-primary focus:ring-verde-primary"
              />
              {opt.label}
            </label>
          ))}
        </div>
        {imageSrc && (
          <div className="w-32 shrink-0 self-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc}
              alt={`Referência OWAS: ${title}`}
              className="h-auto w-full rounded border border-gray-200"
            />
          </div>
        )}
      </div>
    </div>
  );
}
