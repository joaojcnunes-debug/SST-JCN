"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Copy, ChevronDown } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import CargoForm from "../CargoForm";
import CopiarCargoModal from "../CopiarCargoModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Cargo, Setor } from "@/lib/supabase/types";

interface Props {
  idInspecao: string;
  idEmpresa: string;
  setores: Setor[];
  cargos: Cargo[];
  readOnly?: boolean;
}

export default function CargosTab({
  idInspecao,
  idEmpresa,
  setores,
  cargos,
  readOnly,
}: Props) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [activeSetor, setActiveSetor] = useState<string | null>(null);
  const [editing, setEditing] = useState<Cargo | null>(null);
  const [confirm, setConfirm] = useState<Cargo | null>(null);
  const [openSetores, setOpenSetores] = useState<Record<string, boolean>>({});
  const [copiando, setCopiando] = useState<Cargo | null>(null);

  const del = useMutation({
    mutationFn: async (c: Cargo) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("cargos")
        .delete()
        .eq("id_cargo", c.id_cargo);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
      toast.success("Cargo removido");
      setConfirm(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (setores.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Adicione um setor antes de cadastrar cargos.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {setores.map((s) => {
        const cargosDoSetor = cargos.filter((c) => c.id_setor === s.id_setor);
        const isOpen = openSetores[s.id_setor] ?? true;
        return (
          <div
            key={s.id_setor}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white"
          >
            <button
              type="button"
              onClick={() =>
                setOpenSetores((m) => ({ ...m, [s.id_setor]: !isOpen }))
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
                {s.setor_ghe}
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-600">
                  {cargosDoSetor.length}
                </span>
              </span>
              {!readOnly && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSetor(s.id_setor);
                    setEditing(null);
                    setFormOpen(true);
                  }}
                  className="flex items-center gap-1 rounded-md bg-verde-primary px-2 py-1 text-xs font-medium text-white hover:bg-verde-accent cursor-pointer"
                >
                  <Plus className="size-3" /> Cargo
                </span>
              )}
            </button>
            {isOpen && (
              <ul className="divide-y divide-gray-100">
                {cargosDoSetor.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-gray-500">
                    Nenhum cargo neste setor.
                  </li>
                ) : (
                  cargosDoSetor.map((c) => (
                    <li
                      key={c.id_cargo}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {c.cargo}
                        </p>
                        {c.descricao && (
                          <p className="text-xs text-gray-500">{c.descricao}</p>
                        )}
                      </div>
                      {!readOnly && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveSetor(c.id_setor);
                              setEditing(c);
                              setFormOpen(true);
                            }}
                            className="rounded p-1.5 text-gray-500 hover:bg-verde-light hover:text-verde-primary"
                            title="Editar"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setCopiando(c)}
                            className="rounded p-1.5 text-gray-500 hover:bg-blue-50 hover:text-blue-700"
                            title="Copiar para outro setor ou empresa"
                          >
                            <Copy className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirm(c)}
                            className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-alert"
                            title="Excluir"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      )}
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        );
      })}

      <CopiarCargoModal
        open={!!copiando}
        onClose={() => setCopiando(null)}
        cargo={copiando}
        setoresAtual={setores}
      />

      <CargoForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        idInspecao={idInspecao}
        idEmpresa={idEmpresa}
        idSetor={activeSetor ?? setores[0]?.id_setor ?? ""}
        setores={setores}
        cargo={editing}
      />
      <ConfirmDialog
        open={!!confirm}
        title="Excluir cargo?"
        description={`O cargo "${confirm?.cargo}" será removido.`}
        variant="danger"
        loading={del.isPending}
        onConfirm={() => confirm && del.mutate(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
