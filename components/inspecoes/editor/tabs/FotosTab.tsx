"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Image as ImageIcon } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import FotoForm from "../FotoForm";
import StorageImg from "@/components/ui/StorageImg";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { CATEGORIAS_FOTO, CATEGORIA_FOTO_ICONE } from "@/lib/constants";
import type { CategoriaFoto, Foto, Setor } from "@/lib/supabase/types";

interface Props {
  idInspecao: string;
  idEmpresa: string;
  fotos: Foto[];
  setores: Setor[];
  readOnly?: boolean;
}

export default function FotosTab({
  idInspecao,
  idEmpresa,
  fotos,
  setores,
  readOnly,
}: Props) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Foto | null>(null);
  const [confirm, setConfirm] = useState<Foto | null>(null);

  const grupos = useMemo(() => {
    const acc = new Map<CategoriaFoto, Foto[]>();
    for (const f of fotos) {
      const arr = acc.get(f.categoria) ?? [];
      arr.push(f);
      acc.set(f.categoria, arr);
    }
    return acc;
  }, [fotos]);

  const del = useMutation({
    mutationFn: async (f: Foto) => {
      const supabase = createSupabaseBrowserClient();
      // Apaga registro e arquivo do storage (best-effort).
      if (f.storage_path) {
        await supabase.storage.from("fotos").remove([f.storage_path]);
      }
      const { error } = await supabase
        .from("fotos")
        .delete()
        .eq("id_foto", f.id_foto);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
      toast.success("Foto removida");
      setConfirm(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent"
          >
            <Plus className="size-4" /> Enviar Foto
          </button>
        </div>
      )}

      {fotos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <ImageIcon className="mx-auto size-10 text-gray-400" />
          <p className="mt-2 text-sm text-gray-600">Nenhuma foto enviada.</p>
        </div>
      ) : (
        CATEGORIAS_FOTO.filter((c) => grupos.has(c)).map((cat) => {
          const lista = grupos.get(cat) ?? [];
          return (
            <section key={cat}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                <span>{CATEGORIA_FOTO_ICONE[cat]}</span>
                {cat}
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {lista.length}
                </span>
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {lista.map((f) => (
                  <div
                    key={f.id_foto}
                    className="group overflow-hidden rounded-lg border border-gray-200 bg-white"
                  >
                    <div className="relative aspect-square bg-gray-100">
                      <StorageImg
                        stored={f.storage_path || f.arquivo_foto}
                        alt={f.legenda ?? cat}
                        className="size-full object-cover"
                      />
                      {!readOnly && (
                        <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(f);
                              setFormOpen(true);
                            }}
                            className="rounded bg-white/90 p-1 text-gray-700 shadow hover:bg-white"
                            title="Editar"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirm(f)}
                            className="rounded bg-white/90 p-1 text-red-alert shadow hover:bg-white"
                            title="Excluir"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="truncate text-xs text-gray-700">
                        {f.legenda ?? "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}

      <FotoForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        idInspecao={idInspecao}
        idEmpresa={idEmpresa}
        setores={setores}
        foto={editing}
      />
      <ConfirmDialog
        open={!!confirm}
        title="Excluir foto?"
        description="A foto será removida do sistema e do storage."
        variant="danger"
        loading={del.isPending}
        onConfirm={() => confirm && del.mutate(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
