"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import { CATEGORIAS_FOTO } from "@/lib/constants";
import type { CategoriaFoto, Foto } from "@/lib/supabase/types";
import { useUserStore } from "@/lib/store";

interface Props {
  open: boolean;
  onClose: () => void;
  idInspecao: string;
  idEmpresa: string;
  foto?: Foto | null;
}

export default function FotoForm({
  open,
  onClose,
  idInspecao,
  idEmpresa,
  foto,
}: Props) {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);
  const isEdit = !!foto;

  const [categoria, setCategoria] = useState<CategoriaFoto>("Geral");
  const [legenda, setLegenda] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (open) {
      setCategoria((foto?.categoria as CategoriaFoto) ?? "Geral");
      setLegenda(foto?.legenda ?? "");
      setFile(null);
      setProgress(0);
    }
  }, [open, foto]);

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createSupabaseBrowserClient();

      if (isEdit && foto) {
        const { error } = await supabase
          .from("fotos")
          .update({ categoria, legenda: legenda.trim() || null } as never)
          .eq("id_foto", foto.id_foto);
        if (error) throw error;
        return;
      }

      if (!file) throw new Error("Selecione um arquivo");

      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${idEmpresa}/${idInspecao}/${gerarId("FT")}.${ext}`;

      setProgress(20);
      const { error: upErr } = await supabase.storage
        .from("fotos")
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      setProgress(70);

      const { data: pub } = supabase.storage.from("fotos").getPublicUrl(path);

      const insertRow = {
        id_foto: gerarId("FOTO"),
        id_inspecao: idInspecao,
        id_empresa: idEmpresa,
        categoria,
        legenda: legenda.trim() || null,
        arquivo_foto: pub.publicUrl,
        storage_path: path,
        data_upload: new Date().toISOString(),
        usuario: user?.email ?? null,
      };
      const { error: insErr } = await supabase
        .from("fotos")
        .insert(insertRow as never);
      if (insErr) throw insErr;
      setProgress(100);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
      toast.success(isEdit ? "Foto atualizada" : "Foto enviada");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar Foto" : "Enviar Foto"}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {!isEdit && (
          <div>
            <label className={lblCls}>Arquivo *</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-verde-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-verde-accent"
            />
            {file && (
              <p className="mt-1 text-xs text-gray-500">
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </p>
            )}
          </div>
        )}
        <div>
          <label className={lblCls}>Categoria</label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as CategoriaFoto)}
            className={inputCls}
          >
            {CATEGORIAS_FOTO.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={lblCls}>Legenda</label>
          <input
            type="text"
            value={legenda}
            onChange={(e) => setLegenda(e.target.value)}
            className={inputCls}
            placeholder="Descrição da foto"
          />
        </div>

        {mutation.isPending && (
          <div>
            <p className="text-xs text-gray-500">Enviando... {progress}%</p>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full bg-verde-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending || (!isEdit && !file)}
            className="rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-60"
          >
            {mutation.isPending ? "Enviando..." : isEdit ? "Salvar" : "Enviar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const inputCls =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30";
const lblCls = "text-sm font-medium text-gray-700";
