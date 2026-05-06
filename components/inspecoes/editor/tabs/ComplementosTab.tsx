"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Sticker } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import ComplementoForm from "../ComplementoForm";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Complemento, Setor } from "@/lib/supabase/types";

interface Props {
  idInspecao: string;
  idEmpresa: string;
  setores: Setor[];
  complementos: Complemento[];
  readOnly?: boolean;
}

export default function ComplementosTab({
  idInspecao,
  idEmpresa,
  setores,
  complementos,
  readOnly,
}: Props) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Complemento | null>(null);
  const [confirm, setConfirm] = useState<Complemento | null>(null);

  const setorMap = new Map(setores.map((s) => [s.id_setor, s.setor_ghe]));

  const del = useMutation({
    mutationFn: async (c: Complemento) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("complementos")
        .delete()
        .eq("id_complemento", c.id_complemento);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
      toast.success("Removido");
      setConfirm(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
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
            <Plus className="size-4" /> Adicionar Complemento
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {complementos.length === 0 ? (
          <div className="flex flex-col items-center p-8 text-center text-sm text-gray-500">
            <Sticker className="size-8 text-gray-400" />
            <p className="mt-2">Nenhum complemento cadastrado.</p>
            <p className="text-xs text-gray-400">
              Use complementos para registrar procedimentos, treinamentos,
              ordens de serviço ou qualquer informação extra.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Tipo</th>
                <th className="px-4 py-2 text-left font-medium">Título</th>
                <th className="px-4 py-2 text-left font-medium">Setor</th>
                <th className="px-4 py-2 text-left font-medium">Descrição</th>
                <th className="px-4 py-2 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {complementos.map((c) => (
                <tr key={c.id_complemento} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    {c.tipo ? (
                      <span className="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-xs font-medium text-gray-700">
                        {c.tipo}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2 font-medium text-gray-900">
                    {c.titulo ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {c.id_setor ? setorMap.get(c.id_setor) ?? "—" : "Geral"}
                  </td>
                  <td className="px-4 py-2 text-gray-600 max-w-md truncate">
                    {c.descricao ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      {!readOnly && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(c);
                              setFormOpen(true);
                            }}
                            className="rounded p-1.5 text-gray-500 hover:bg-verde-light hover:text-verde-primary"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirm(c)}
                            className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-alert"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ComplementoForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        idInspecao={idInspecao}
        idEmpresa={idEmpresa}
        setores={setores}
        complemento={editing}
      />
      <ConfirmDialog
        open={!!confirm}
        title="Excluir complemento?"
        description={confirm?.titulo ?? undefined}
        variant="danger"
        loading={del.isPending}
        onConfirm={() => confirm && del.mutate(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
