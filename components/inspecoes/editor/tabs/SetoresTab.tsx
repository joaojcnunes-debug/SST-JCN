"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Copy } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import SetorForm from "../SetorForm";
import CopiarSetorModal from "../CopiarSetorModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Setor } from "@/lib/supabase/types";

interface Props {
  idInspecao: string;
  idEmpresa: string;
  setores: Setor[];
  readOnly?: boolean;
}

export default function SetoresTab({
  idInspecao,
  idEmpresa,
  setores,
  readOnly,
}: Props) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Setor | null>(null);
  const [confirm, setConfirm] = useState<Setor | null>(null);
  const [copiando, setCopiando] = useState<Setor | null>(null);

  const del = useMutation({
    mutationFn: async (s: Setor) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("setores")
        .delete()
        .eq("id_setor", s.id_setor);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
      toast.success("Setor removido");
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
            <Plus className="size-4" /> Adicionar Setor
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {setores.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            Nenhum setor cadastrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Setor / GHE</th>
                  <th className="px-4 py-2 text-left font-medium">Descrição</th>
                  <th className="px-4 py-2 text-left font-medium">Conformidade</th>
                  <th className="px-4 py-2 text-left font-medium">N. Conformidade</th>
                  <th className="px-4 py-2 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {setores.map((s) => (
                  <tr key={s.id_setor} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900">
                      {s.setor_ghe}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {s.descricao ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {s.conformidade ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {s.nao_conformidade ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        {!readOnly && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditing(s);
                                setFormOpen(true);
                              }}
                              className="rounded p-1.5 text-gray-500 hover:bg-verde-light hover:text-verde-primary"
                              title="Editar"
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setCopiando(s)}
                              className="rounded p-1.5 text-gray-500 hover:bg-blue-50 hover:text-blue-700"
                              title="Copiar para outra inspeção ou empresa"
                            >
                              <Copy className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirm(s)}
                              className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-alert"
                              title="Excluir"
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
          </div>
        )}
      </div>

      <CopiarSetorModal
        open={!!copiando}
        onClose={() => setCopiando(null)}
        setor={copiando}
        idEmpresaOrigem={idEmpresa}
      />

      <SetorForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        idInspecao={idInspecao}
        idEmpresa={idEmpresa}
        setor={editing}
      />
      <ConfirmDialog
        open={!!confirm}
        title="Excluir setor?"
        description={`O setor "${confirm?.setor_ghe}" será removido. Esta ação não pode ser desfeita.`}
        variant="danger"
        loading={del.isPending}
        onConfirm={() => confirm && del.mutate(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
