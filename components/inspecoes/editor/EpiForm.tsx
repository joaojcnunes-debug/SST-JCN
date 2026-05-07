"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import { useTipoIcone } from "@/lib/hooks/useV3";
import type { EpiEpc, Risco } from "@/lib/supabase/types";

interface Props {
  open: boolean;
  onClose: () => void;
  idInspecao: string;
  idEmpresa: string;
  riscos: Risco[];
  epi?: EpiEpc | null;
}

export default function EpiForm({
  open,
  onClose,
  idInspecao,
  idEmpresa,
  riscos,
  epi,
}: Props) {
  const qc = useQueryClient();
  const iconeDe = useTipoIcone();
  const isEdit = !!epi;
  const [form, setForm] = useState({
    id_risco: "",
    tipo: "EPI" as "EPI" | "EPC",
    descricao: "",
    ca: "",
    recomendado: "Sim" as "Sim" | "Não",
  });

  useEffect(() => {
    if (open) {
      setForm({
        id_risco: epi?.id_risco ?? riscos[0]?.id_risco ?? "",
        tipo: (epi?.tipo as "EPI" | "EPC") ?? "EPI",
        descricao: epi?.descricao ?? "",
        ca: epi?.ca ?? "",
        recomendado: (epi?.recomendado as "Sim" | "Não") ?? "Sim",
      });
    }
  }, [open, epi, riscos]);

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const r = riscos.find((x) => x.id_risco === form.id_risco);
      const payload = {
        id_risco: form.id_risco,
        tipo: form.tipo,
        descricao: form.descricao.trim(),
        ca: form.ca.trim() || null,
        recomendado: form.recomendado,
        id_setor: r?.id_setor ?? null,
      };
      if (isEdit && epi) {
        const { error } = await supabase
          .from("epi_epc")
          .update(payload as never)
          .eq("id_protecao", epi.id_protecao);
        if (error) throw error;
      } else {
        const row = {
          id_protecao: gerarId("EPI"),
          id_inspecao: idInspecao,
          id_empresa: idEmpresa,
          ...payload,
        };
        const { error } = await supabase.from("epi_epc").insert(row as never);
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
    if (!form.descricao.trim()) {
      toast.error("Descrição é obrigatória");
      return;
    }
    if (!form.id_risco) {
      toast.error("Vincule a um risco");
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar Proteção" : "Adicionar EPI/EPC"}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className={lblCls}>Risco vinculado *</label>
          <select
            value={form.id_risco}
            onChange={(e) => setForm({ ...form, id_risco: e.target.value })}
            className={inputCls}
            required
          >
            <option value="">Selecione...</option>
            {riscos.map((r) => (
              <option key={r.id_risco} value={r.id_risco}>
                {iconeDe(r.tipo_risco)} {r.tipo_risco} —{" "}
                {r.agente ?? r.id_risco}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={lblCls}>Tipo</label>
            <select
              value={form.tipo}
              onChange={(e) =>
                setForm({ ...form, tipo: e.target.value as "EPI" | "EPC" })
              }
              className={inputCls}
            >
              <option value="EPI">EPI</option>
              <option value="EPC">EPC</option>
            </select>
          </div>
          <div>
            <label className={lblCls}>Recomendado</label>
            <select
              value={form.recomendado}
              onChange={(e) =>
                setForm({
                  ...form,
                  recomendado: e.target.value as "Sim" | "Não",
                })
              }
              className={inputCls}
            >
              <option value="Sim">Sim</option>
              <option value="Não">Não</option>
            </select>
          </div>
        </div>
        <div>
          <label className={lblCls}>Descrição *</label>
          <input
            type="text"
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            className={inputCls}
            required
          />
        </div>
        <div>
          <label className={lblCls}>Certificado de Aprovação (CA)</label>
          <input
            type="text"
            value={form.ca}
            onChange={(e) => setForm({ ...form, ca: e.target.value })}
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
