"use client";

import { useMemo, useState } from "react";
import { Plus, ChevronDown } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import RiscoForm from "../RiscoForm";
import RiscoRow from "@/components/riscos/RiscoRow";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { TIPO_ICONE, TIPOS_RISCO } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Cargo, Risco, Setor, TipoRisco } from "@/lib/supabase/types";

interface Props {
  idInspecao: string;
  idEmpresa: string;
  setores: Setor[];
  cargos: Cargo[];
  riscos: Risco[];
  readOnly?: boolean;
}

export default function RiscosTab({
  idInspecao,
  idEmpresa,
  setores,
  cargos,
  riscos,
  readOnly,
}: Props) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Risco | null>(null);
  const [confirm, setConfirm] = useState<Risco | null>(null);
  const [openTipos, setOpenTipos] = useState<Record<string, boolean>>({});

  const setorMap = useMemo(
    () => new Map(setores.map((s) => [s.id_setor, s.setor_ghe])),
    [setores]
  );

  const grupos = useMemo(() => {
    const acc = new Map<TipoRisco, Risco[]>();
    for (const r of riscos) {
      const arr = acc.get(r.tipo_risco) ?? [];
      arr.push(r);
      acc.set(r.tipo_risco, arr);
    }
    return acc;
  }, [riscos]);

  const del = useMutation({
    mutationFn: async (r: Risco) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("riscos")
        .delete()
        .eq("id_risco", r.id_risco);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
      toast.success("Risco removido");
      setConfirm(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (setores.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Adicione um setor antes de cadastrar riscos.
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
            <Plus className="size-4" /> Adicionar Risco
          </button>
        </div>
      )}

      {riscos.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          Nenhum risco cadastrado nesta inspeção.
        </div>
      ) : (
        TIPOS_RISCO.filter((t) => grupos.has(t)).map((tipo) => {
          const lista = grupos.get(tipo) ?? [];
          const isOpen = openTipos[tipo] ?? true;
          return (
            <div
              key={tipo}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white"
            >
              <button
                type="button"
                onClick={() =>
                  setOpenTipos((m) => ({ ...m, [tipo]: !isOpen }))
                }
                className="flex w-full items-center justify-between bg-gray-50 px-4 py-2.5 text-left hover:bg-gray-100"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <ChevronDown
                    className={cn(
                      "size-4 text-gray-500 transition-transform",
                      !isOpen && "-rotate-90"
                    )}
                  />
                  <span className="text-base">{TIPO_ICONE[tipo] ?? "•"}</span>
                  {tipo}
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-600">
                    {lista.length}
                  </span>
                </span>
              </button>
              {isOpen && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white text-xs uppercase text-gray-500 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Agente</th>
                        <th className="px-4 py-2 text-left font-medium">Setor</th>
                        <th className="px-4 py-2 text-left font-medium">Probabilidade</th>
                        <th className="px-4 py-2 text-left font-medium">Severidade</th>
                        <th className="px-4 py-2 text-left font-medium">Nível</th>
                        <th className="px-4 py-2 text-right font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {lista.map((r) => (
                        <RiscoRow
                          key={r.id_risco}
                          risco={r}
                          setorNome={
                            r.id_setor ? setorMap.get(r.id_setor) : undefined
                          }
                          readOnly={readOnly}
                          onEdit={(risco) => {
                            setEditing(risco);
                            setFormOpen(true);
                          }}
                          onDelete={(risco) => setConfirm(risco)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })
      )}

      <RiscoForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        idInspecao={idInspecao}
        idEmpresa={idEmpresa}
        setores={setores}
        cargos={cargos}
        risco={editing}
      />
      <ConfirmDialog
        open={!!confirm}
        title="Excluir risco?"
        description={`O risco "${confirm?.agente ?? confirm?.tipo_risco}" será removido.`}
        variant="danger"
        loading={del.isPending}
        onConfirm={() => confirm && del.mutate(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
