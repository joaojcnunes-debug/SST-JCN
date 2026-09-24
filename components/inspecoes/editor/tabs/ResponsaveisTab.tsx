"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import ResponsavelForm from "../ResponsavelForm";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useExcluirDaInspecao } from "@/lib/hooks/useExcluirDaInspecao";
import { fmtDataHora } from "@/lib/utils";
import type { Responsavel } from "@/lib/supabase/types";

interface Props {
  idInspecao: string;
  idEmpresa: string;
  responsaveis: Responsavel[];
  readOnly?: boolean;
}

export default function ResponsaveisTab({
  idInspecao,
  idEmpresa,
  responsaveis,
  readOnly,
}: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Responsavel | null>(null);
  const [confirm, setConfirm] = useState<Responsavel | null>(null);

  const del = useExcluirDaInspecao({
    idInspecao,
    tabela: "responsaveis",
    chave: "id_responsavel",
    colecao: "responsaveis",
    rotulo: "Responsavel removido",
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
            <Plus className="size-4" /> Adicionar
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {responsaveis.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            Nenhum responsável cadastrado.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Técnico SST</th>
                <th className="px-4 py-2 text-left font-medium">
                  Recepcionado por
                </th>
                <th className="px-4 py-2 text-left font-medium">Cargo</th>
                <th className="px-4 py-2 text-left font-medium">Data/Hora</th>
                <th className="px-4 py-2 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {responsaveis.map((r) => (
                <tr key={r.id_responsavel} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">
                    {r.tecnico_responsavel ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {r.recepcionado_por ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{r.cargo ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {fmtDataHora(r.data_hora)}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      {!readOnly && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(r);
                              setFormOpen(true);
                            }}
                            className="rounded p-1.5 text-gray-500 hover:bg-verde-light hover:text-verde-primary"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirm(r)}
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

      <ResponsavelForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        idInspecao={idInspecao}
        idEmpresa={idEmpresa}
        responsavel={editing}
      />
      <ConfirmDialog
        open={!!confirm}
        title="Excluir responsável?"
        variant="danger"
        loading={del.isPending}
        onConfirm={() =>
          confirm && del.mutate(confirm, { onSuccess: () => setConfirm(null) })
        }
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
