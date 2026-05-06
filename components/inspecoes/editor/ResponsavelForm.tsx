"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import type { Responsavel } from "@/lib/supabase/types";

interface Props {
  open: boolean;
  onClose: () => void;
  idInspecao: string;
  idEmpresa: string;
  responsavel?: Responsavel | null;
}

export default function ResponsavelForm({
  open,
  onClose,
  idInspecao,
  idEmpresa,
  responsavel,
}: Props) {
  const qc = useQueryClient();
  const isEdit = !!responsavel;
  const [form, setForm] = useState({
    tecnico_responsavel: "",
    recepcionado_por: "",
    cargo: "",
    data_hora: new Date().toISOString().slice(0, 16),
  });

  useEffect(() => {
    if (open) {
      setForm({
        tecnico_responsavel: responsavel?.tecnico_responsavel ?? "",
        recepcionado_por: responsavel?.recepcionado_por ?? "",
        cargo: responsavel?.cargo ?? "",
        data_hora: responsavel?.data_hora
          ? new Date(responsavel.data_hora).toISOString().slice(0, 16)
          : new Date().toISOString().slice(0, 16),
      });
    }
  }, [open, responsavel]);

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const payload = {
        tecnico_responsavel: form.tecnico_responsavel.trim() || null,
        recepcionado_por: form.recepcionado_por.trim() || null,
        cargo: form.cargo.trim() || null,
        data_hora: new Date(form.data_hora).toISOString(),
      };
      if (isEdit && responsavel) {
        const { error } = await supabase
          .from("responsaveis")
          .update(payload as never)
          .eq("id_responsavel", responsavel.id_responsavel);
        if (error) throw error;
      } else {
        const row = {
          id_responsavel: gerarId("RSP"),
          id_inspecao: idInspecao,
          id_empresa: idEmpresa,
          ...payload,
        };
        const { error } = await supabase
          .from("responsaveis")
          .insert(row as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
      toast.success(isEdit ? "Atualizado" : "Adicionado");
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
      title={isEdit ? "Editar Responsável" : "Novo Responsável"}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className={lblCls}>Técnico SST</label>
          <input
            type="text"
            value={form.tecnico_responsavel}
            onChange={(e) =>
              setForm({ ...form, tecnico_responsavel: e.target.value })
            }
            className={inputCls}
          />
        </div>
        <div>
          <label className={lblCls}>Recepcionado por</label>
          <input
            type="text"
            value={form.recepcionado_por}
            onChange={(e) =>
              setForm({ ...form, recepcionado_por: e.target.value })
            }
            className={inputCls}
          />
        </div>
        <div>
          <label className={lblCls}>Cargo</label>
          <input
            type="text"
            value={form.cargo}
            onChange={(e) => setForm({ ...form, cargo: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={lblCls}>Data/Hora</label>
          <input
            type="datetime-local"
            value={form.data_hora}
            onChange={(e) => setForm({ ...form, data_hora: e.target.value })}
            className={inputCls}
          />
        </div>
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
            disabled={mutation.isPending}
            className="rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-60"
          >
            {mutation.isPending ? "Salvando..." : isEdit ? "Salvar" : "Adicionar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const inputCls =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30";
const lblCls = "text-sm font-medium text-gray-700";
