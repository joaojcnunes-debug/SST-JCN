"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Copy, ShieldCheck } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import EpiForm from "../EpiForm";
import CopiarEpiModal from "../CopiarEpiModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { TIPO_ICONE } from "@/lib/constants";
import type { EpiEpc, Risco } from "@/lib/supabase/types";

interface Props {
  idInspecao: string;
  idEmpresa: string;
  riscos: Risco[];
  epis: EpiEpc[];
  readOnly?: boolean;
}

export default function EpisTab({
  idInspecao,
  idEmpresa,
  riscos,
  epis,
  readOnly,
}: Props) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EpiEpc | null>(null);
  const [confirm, setConfirm] = useState<EpiEpc | null>(null);
  const [copiando, setCopiando] = useState<EpiEpc | null>(null);

  const riscoMap = useMemo(() => new Map(riscos.map((r) => [r.id_risco, r])), [riscos]);

  const grupos = useMemo(() => {
    const acc = new Map<string, EpiEpc[]>();
    for (const e of epis) {
      const arr = acc.get(e.id_risco) ?? [];
      arr.push(e);
      acc.set(e.id_risco, arr);
    }
    return acc;
  }, [epis]);

  const del = useMutation({
    mutationFn: async (e: EpiEpc) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("epi_epc")
        .delete()
        .eq("id_protecao", e.id_protecao);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
      toast.success("Removido");
      setConfirm(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (riscos.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Adicione riscos antes de cadastrar EPIs/EPCs.
      </div>
    );
  }

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
            <Plus className="size-4" /> Adicionar EPI/EPC
          </button>
        </div>
      )}

      {epis.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          Nenhum EPI/EPC cadastrado.
        </div>
      ) : (
        Array.from(grupos.entries()).map(([idRisco, lista]) => {
          const r = riscoMap.get(idRisco);
          return (
            <div
              key={idRisco}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white"
            >
              <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 text-sm">
                <span className="text-base">
                  {r ? TIPO_ICONE[r.tipo_risco] ?? "•" : <ShieldCheck className="size-4" />}
                </span>
                <span className="font-semibold text-gray-900">
                  {r?.tipo_risco ?? "Risco"} — {r?.agente ?? "—"}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-600">
                  {lista.length}
                </span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-white text-xs uppercase text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Tipo</th>
                    <th className="px-4 py-2 text-left font-medium">Descrição</th>
                    <th className="px-4 py-2 text-left font-medium">CA</th>
                    <th className="px-4 py-2 text-left font-medium">Recomendado</th>
                    <th className="px-4 py-2 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lista.map((e) => (
                    <tr key={e.id_protecao} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <span className="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-xs font-medium text-gray-700">
                          {e.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-medium text-gray-900">
                        {e.descricao}
                      </td>
                      <td className="px-4 py-2 text-gray-600">{e.ca ?? "—"}</td>
                      <td className="px-4 py-2 text-gray-600">{e.recomendado ?? "—"}</td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1">
                          {!readOnly && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditing(e);
                                  setFormOpen(true);
                                }}
                                className="rounded p-1.5 text-gray-500 hover:bg-verde-light hover:text-verde-primary"
                                title="Editar"
                              >
                                <Pencil className="size-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setCopiando(e)}
                                className="rounded p-1.5 text-gray-500 hover:bg-blue-50 hover:text-blue-700"
                                title="Copiar para outra empresa"
                              >
                                <Copy className="size-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirm(e)}
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
          );
        })
      )}

      <CopiarEpiModal
        open={!!copiando}
        onClose={() => setCopiando(null)}
        epi={copiando}
      />

      <EpiForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        idInspecao={idInspecao}
        idEmpresa={idEmpresa}
        riscos={riscos}
        epi={editing}
      />
      <ConfirmDialog
        open={!!confirm}
        title="Excluir item?"
        description={`"${confirm?.descricao}" será removido.`}
        variant="danger"
        loading={del.isPending}
        onConfirm={() => confirm && del.mutate(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
