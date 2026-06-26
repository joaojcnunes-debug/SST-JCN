"use client";

import { useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  SLUG_TO_DEFAULT_IMAGE,
  useAetCriarPerfilOwas,
  useAetExcluirPerfilOwas,
  useAetOwasConfig,
  useAetPerfisOwas,
  useAetSalvarPerfilOwas,
} from "@/lib/hooks/useAet";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import StorageImg from "@/components/ui/StorageImg";
import type { AetOwasCategoria, AetPerfilOwas } from "@/lib/supabase/types";

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
  const { data: perfis = [], isLoading: loadingPerfis } = useAetPerfisOwas();
  const { data: categorias = [] } = useAetOwasConfig();
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
            Cadastre perfis de posturas reutilizáveis. Na análise de cada setor,
            selecione um perfil para preencher os campos automaticamente.
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

      {loadingPerfis ? (
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
              categorias={categorias}
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
            onSuccess: () => {
              setConfirmExcluir(null);
              toast.success("Perfil excluído");
            },
          });
        }}
        onCancel={() => setConfirmExcluir(null)}
      />
    </div>
  );
}

// ─── PerfilCard ───────────────────────────────────────────────────────────────

const SLUG_TO_FIELD: Record<string, keyof Omit<AetPerfilOwas, "id" | "nome" | "created_at">> = {
  costas: "posturas_costas",
  bracos: "posturas_bracos",
  pernas: "posturas_pernas",
  esforco: "esforco",
};

function PerfilCard({
  perfil,
  categorias,
  onExcluir,
}: {
  perfil: AetPerfilOwas;
  categorias: AetOwasCategoria[];
  onExcluir: () => void;
}) {
  const salvar = useAetSalvarPerfilOwas();

  const [nome, setNome] = useState(perfil.nome);
  const [selections, setSelections] = useState<Record<string, number[]>>({
    costas: perfil.posturas_costas,
    bracos: perfil.posturas_bracos,
    pernas: perfil.posturas_pernas,
    esforco: perfil.esforco,
  });

  function toggleVal(slug: string, value: number) {
    setSelections((prev) => {
      const current = prev[slug] ?? [];
      return {
        ...prev,
        [slug]: current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value],
      };
    });
  }

  function handleSave() {
    salvar.mutate(
      {
        id: perfil.id,
        nome: nome.trim() || "Sem nome",
        posturas_costas: (selections.costas ?? []) as AetPerfilOwas["posturas_costas"],
        posturas_bracos: (selections.bracos ?? []) as AetPerfilOwas["posturas_bracos"],
        posturas_pernas: (selections.pernas ?? []) as AetPerfilOwas["posturas_pernas"],
        esforco: (selections.esforco ?? []) as AetPerfilOwas["esforco"],
      },
      { onSuccess: () => toast.success("Perfil salvo") }
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {categorias.map((cat) => (
          <OwasGroupPerfil
            key={cat.id}
            categoria={cat}
            selected={selections[cat.slug] ?? []}
            onToggle={(v) => toggleVal(cat.slug, v)}
          />
        ))}
        {categorias.length === 0 && (
          <p className="col-span-2 text-xs text-gray-400">
            Nenhuma categoria configurada. Acesse <strong>Config. OWAS</strong> para inicializar.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── OwasGroupPerfil ──────────────────────────────────────────────────────────

function OwasGroupPerfil({
  categoria,
  selected,
  onToggle,
}: {
  categoria: AetOwasCategoria;
  selected: number[];
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
            <StorageImg
              stored={imageSrc}
              alt={`OWAS: ${categoria.titulo}`}
              className="h-auto w-full rounded border border-gray-200"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Keep SLUG_TO_FIELD in scope (referenced by PerfilCard)
void SLUG_TO_FIELD;
