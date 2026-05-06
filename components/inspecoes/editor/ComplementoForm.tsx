"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import type { Complemento, Setor } from "@/lib/supabase/types";

interface Props {
  open: boolean;
  onClose: () => void;
  idInspecao: string;
  idEmpresa: string;
  setores: Setor[];
  complemento?: Complemento | null;
}

const TIPOS = [
  "Procedimento",
  "Ordem de Serviço",
  "Treinamento",
  "Inspeção Periódica",
  "Sinalização",
  "Documento",
  "Outro",
];

export default function ComplementoForm({
  open,
  onClose,
  idInspecao,
  idEmpresa,
  setores,
  complemento,
}: Props) {
  const qc = useQueryClient();
  const isEdit = !!complemento;
  const [form, setForm] = useState({
    tipo: "",
    titulo: "",
    descricao: "",
    id_setor: "",
    dados: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        tipo: complemento?.tipo ?? "",
        titulo: complemento?.titulo ?? "",
        descricao: complemento?.descricao ?? "",
        id_setor: complemento?.id_setor ?? "",
        dados: complemento?.dados ?? "",
      });
    }
  }, [open, complemento]);

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const payload = {
        tipo: form.tipo.trim() || null,
        titulo: form.titulo.trim() || null,
        descricao: form.descricao.trim() || null,
        id_setor: form.id_setor || null,
        dados: form.dados.trim() || null,
      };
      if (isEdit && complemento) {
        const { error } = await supabase
          .from("complementos")
          .update(payload as never)
          .eq("id_complemento", complemento.id_complemento);
        if (error) throw error;
      } else {
        const row = {
          id_complemento: gerarId("CMP"),
          id_inspecao: idInspecao,
          id_empresa: idEmpresa,
          ...payload,
        };
        const { error } = await supabase
          .from("complementos")
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
    if (!form.titulo.trim()) {
      toast.error("Informe um título");
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar Complemento" : "Novo Complemento"}
      size="lg"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={lblCls}>Tipo</label>
            <select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              className={inputCls}
            >
              <option value="">—</option>
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={lblCls}>Setor (opcional)</label>
            <select
              value={form.id_setor}
              onChange={(e) => setForm({ ...form, id_setor: e.target.value })}
              className={inputCls}
            >
              <option value="">— Geral —</option>
              {setores.map((s) => (
                <option key={s.id_setor} value={s.id_setor}>
                  {s.setor_ghe}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={lblCls}>Título *</label>
          <input
            type="text"
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            className={inputCls}
            required
          />
        </div>
        <div>
          <label className={lblCls}>Descrição</label>
          <textarea
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            rows={4}
            className={inputCls}
          />
        </div>
        <div>
          <label className={lblCls}>Dados adicionais (texto livre)</label>
          <textarea
            value={form.dados}
            onChange={(e) => setForm({ ...form, dados: e.target.value })}
            rows={2}
            className={inputCls}
            placeholder="Notas, observações ou metadados"
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
