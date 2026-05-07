"use client";

import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  ChevronDown,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  useTiposRisco,
  useSaveTipoRisco,
  useDeleteTipoRisco,
} from "@/lib/hooks/useV3";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import CatalogoTipoPanel from "./CatalogoTipoPanel";
import { gerarId, cn } from "@/lib/utils";
import type { TipoRiscoCustom } from "@/lib/supabase/types";

const ICONES_SUGERIDOS = [
  "⚡", "🌡️", "⚗️", "🦠", "🏋️", "🧠", "🌿", "📋", "⚠️",
  "🔥", "💧", "❄️", "🌪️", "☀️", "💥", "🚧", "⚙️", "🔋",
  "🩺", "🧯", "🪖", "🛡️", "📷", "🚨",
];

export default function TiposRiscoTab() {
  const { data: tipos = [], isLoading } = useTiposRisco({ incluirInativos: true });
  const save = useSaveTipoRisco();
  const del = useDeleteTipoRisco();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TipoRiscoCustom | null>(null);
  const [confirm, setConfirm] = useState<TipoRiscoCustom | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  function reordenar(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= tipos.length) return;
    const a = tipos[idx];
    const b = tipos[target];
    save.mutate({ id_tipo: a.id_tipo, ordem: b.ordem });
    save.mutate({ id_tipo: b.id_tipo, ordem: a.ordem });
  }

  if (isLoading) return <LoadingSkeleton rows={5} />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Gerencie os tipos de risco que aparecem no formulário de risco. Tipos
          de sistema só podem ser desativados (não removidos).
        </p>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent"
        >
          <Plus className="size-4" /> Novo Tipo
        </button>
      </div>

      <ul className="space-y-1.5">
        {tipos.map((t, i) => {
          const aberto = expandido === t.id_tipo;
          return (
            <li
              key={t.id_tipo}
              className={cn(
                "overflow-hidden rounded-lg border bg-white",
                t.ativo ? "border-gray-200" : "border-gray-200 opacity-50"
              )}
            >
              <div className="flex items-center gap-2 p-2.5">
                <button
                  type="button"
                  onClick={() => setExpandido(aberto ? null : t.id_tipo)}
                  className="rounded p-1 text-gray-500 hover:bg-gray-100"
                  title={aberto ? "Recolher catálogo" : "Expandir catálogo"}
                >
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform",
                      !aberto && "-rotate-90"
                    )}
                  />
                </button>
                <span className="w-7 text-center text-2xl">{t.icone ?? "•"}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {t.nome}
                    {t.sistema && (
                      <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                        sistema
                      </span>
                    )}
                    {!t.ativo && (
                      <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                        inativo
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 font-mono">{t.id_tipo}</p>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => reordenar(i, -1)}
                    disabled={i === 0}
                    className="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                    title="Subir"
                  >
                    <ArrowUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => reordenar(i, 1)}
                    disabled={i === tipos.length - 1}
                    className="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                    title="Descer"
                  >
                    <ArrowDown className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      save.mutate({ id_tipo: t.id_tipo, ativo: !t.ativo })
                    }
                    className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
                    title={t.ativo ? "Desativar" : "Ativar"}
                  >
                    {t.ativo ? (
                      <Eye className="size-4" />
                    ) : (
                      <EyeOff className="size-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(t);
                      setModalOpen(true);
                    }}
                    className="rounded p-1.5 text-gray-500 hover:bg-verde-light hover:text-verde-primary"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirm(t)}
                    className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-alert"
                    title={t.sistema ? "Desativar" : "Remover"}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              {aberto && <CatalogoTipoPanel idTipo={t.id_tipo} />}
            </li>
          );
        })}
      </ul>

      <TipoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
      />

      <ConfirmDialog
        open={!!confirm}
        title={
          confirm?.sistema ? "Desativar tipo de risco?" : "Remover tipo de risco?"
        }
        description={
          confirm?.sistema
            ? `"${confirm.nome}" é um tipo do sistema e será apenas desativado (não excluído).`
            : `"${confirm?.nome}" será removido permanentemente. Riscos antigos com esse tipo podem ficar com dado órfão.`
        }
        variant="danger"
        loading={del.isPending}
        onConfirm={() => confirm && del.mutate(confirm.id_tipo)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function TipoModal({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: TipoRiscoCustom | null;
}) {
  const save = useSaveTipoRisco();
  const isEdit = !!editing;
  const [nome, setNome] = useState("");
  const [icone, setIcone] = useState("");
  const [ordem, setOrdem] = useState(99);

  // Reseta ao abrir.
  useState(() => {
    if (open) {
      setNome(editing?.nome ?? "");
      setIcone(editing?.icone ?? "");
      setOrdem(editing?.ordem ?? 99);
    }
    return null;
  });
  // useEffect alternativo via key change abaixo.
  if (open && editing && nome === "" && editing.nome !== "") {
    setNome(editing.nome);
    setIcone(editing.icone ?? "");
    setOrdem(editing.ordem);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Informe o nome");
      return;
    }
    save.mutate(
      {
        id_tipo: editing?.id_tipo ?? gerarId("tipo").toLowerCase(),
        nome: nome.trim(),
        icone: icone || null,
        ordem,
        ativo: true,
        sistema: editing?.sistema ?? false,
      },
      {
        onSuccess: () => {
          setNome("");
          setIcone("");
          setOrdem(99);
          onClose();
        },
      }
    );
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setNome("");
        setIcone("");
        onClose();
      }}
      title={isEdit ? "Editar Tipo de Risco" : "Novo Tipo de Risco"}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700">Nome *</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
            placeholder="Ex: Radiação Solar"
            required
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">
            Ícone (emoji)
          </label>
          <input
            type="text"
            value={icone}
            onChange={(e) => setIcone(e.target.value)}
            maxLength={4}
            className="mt-1 w-24 rounded-md border border-gray-300 px-3 py-2 text-center text-2xl focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
            placeholder="🌡️"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ICONES_SUGERIDOS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setIcone(emoji)}
                className={cn(
                  "rounded-md border p-1.5 text-xl hover:bg-gray-50",
                  icone === emoji
                    ? "border-verde-primary bg-verde-light"
                    : "border-gray-200 bg-white"
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">
            Ordem (menor = primeiro)
          </label>
          <input
            type="number"
            value={ordem}
            onChange={(e) => setOrdem(Number(e.target.value) || 0)}
            className="mt-1 w-32 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={() => {
              setNome("");
              setIcone("");
              onClose();
            }}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={save.isPending}
            className="rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-60"
          >
            {save.isPending ? "Salvando..." : isEdit ? "Salvar" : "Criar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
