"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import type { Setor } from "@/lib/supabase/types";

interface Props {
  open: boolean;
  onClose: () => void;
  idInspecao: string;
  idEmpresa: string;
  setor?: Setor | null;
}

export default function SetorForm({
  open,
  onClose,
  idInspecao,
  idEmpresa,
  setor,
}: Props) {
  const qc = useQueryClient();
  const isEdit = !!setor;
  const [form, setForm] = useState({
    setor_ghe: "",
    descricao: "",
    conformidade: "",
    nao_conformidade: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        setor_ghe: setor?.setor_ghe ?? "",
        descricao: setor?.descricao ?? "",
        conformidade: setor?.conformidade ?? "",
        nao_conformidade: setor?.nao_conformidade ?? "",
      });
    }
  }, [open, setor]);

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const payload = {
        setor_ghe: form.setor_ghe.trim(),
        descricao: form.descricao.trim() || null,
        conformidade: form.conformidade.trim() || null,
        nao_conformidade: form.nao_conformidade.trim() || null,
      };
      if (isEdit && setor) {
        const { error } = await supabase
          .from("setores")
          .update(payload as never)
          .eq("id_setor", setor.id_setor);
        if (error) throw error;
      } else {
        const insertRow = {
          id_setor: gerarId("SET"),
          id_inspecao: idInspecao,
          id_empresa: idEmpresa,
          ...payload,
        };
        const { error } = await supabase
          .from("setores")
          .insert(insertRow as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
      toast.success(isEdit ? "Setor atualizado" : "Setor adicionado");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.setor_ghe.trim()) {
      toast.error("Nome do setor é obrigatório");
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar Setor" : "Novo Setor"}
      size="lg"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Nome do Setor / GHE *">
          <input
            type="text"
            value={form.setor_ghe}
            onChange={(e) => setForm({ ...form, setor_ghe: e.target.value })}
            className={inputCls}
            required
          />
        </Field>
        <Field label="Descrição">
          <textarea
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            rows={2}
            className={inputCls}
          />
        </Field>
        <Field label="Conformidade">
          <textarea
            value={form.conformidade}
            onChange={(e) => setForm({ ...form, conformidade: e.target.value })}
            rows={2}
            className={inputCls}
          />
        </Field>
        <Field label="Não Conformidade">
          <textarea
            value={form.nao_conformidade}
            onChange={(e) =>
              setForm({ ...form, nao_conformidade: e.target.value })
            }
            rows={2}
            className={inputCls}
          />
        </Field>
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}
