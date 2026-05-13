"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import type { Empresa } from "@/lib/supabase/types";

interface Props {
  open: boolean;
  onClose: () => void;
  empresa?: Empresa | null;
  /** Chamado apos criar (não edição), recebe o id_empresa novo. */
  onCreated?: (idEmpresa: string) => void;
}

export default function EmpresaForm({
  open,
  onClose,
  empresa,
  onCreated,
}: Props) {
  const qc = useQueryClient();
  const isEdit = !!empresa;

  const [form, setForm] = useState({
    nome_empresa: "",
    razao_social: "",
    cnpj: "",
    grau_risco: 1,
    status: "Ativo" as "Ativo" | "Inativa",
    observacao: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        nome_empresa: empresa?.nome_empresa ?? "",
        razao_social: empresa?.razao_social ?? "",
        cnpj: empresa?.cnpj ?? "",
        grau_risco: empresa?.grau_risco ?? 1,
        status: (empresa?.status as "Ativo" | "Inativa") ?? "Ativo",
        observacao: empresa?.observacao ?? "",
      });
    }
  }, [open, empresa]);

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const payload = {
        nome_empresa: form.nome_empresa.trim(),
        razao_social: form.razao_social.trim() || null,
        cnpj: form.cnpj.replace(/\D/g, "") || null,
        grau_risco: form.grau_risco,
        status: form.status,
        observacao: form.observacao.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (isEdit && empresa) {
        const { error } = await supabase
          .from("empresas")
          .update(payload as never)
          .eq("id_empresa", empresa.id_empresa);
        if (error) throw error;
        return null;
      } else {
        const id = gerarId("EMP");
        const insertRow = {
          id_empresa: id,
          ...payload,
          created_at: new Date().toISOString(),
        };
        const { error } = await supabase
          .from("empresas")
          .insert(insertRow as never);
        if (error) throw error;
        return id;
      }
    },
    onSuccess: (novoId) => {
      qc.invalidateQueries({ queryKey: ["empresas"] });
      toast.success(isEdit ? "Empresa atualizada" : "Empresa criada");
      if (!isEdit && novoId && onCreated) onCreated(novoId);
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao salvar empresa");
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.nome_empresa.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar Empresa" : "Nova Empresa"}
      size="lg"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700">Nome *</label>
          <input
            type="text"
            value={form.nome_empresa}
            onChange={(e) => setForm({ ...form, nome_empresa: e.target.value })}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
            required
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-gray-700">CNPJ</label>
            <input
              type="text"
              value={form.cnpj}
              onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
              placeholder="00.000.000/0000-00"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Razão Social</label>
            <input
              type="text"
              value={form.razao_social}
              onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-gray-700">
              Grau de Risco (NR-04)
            </label>
            <select
              value={form.grau_risco}
              onChange={(e) =>
                setForm({ ...form, grau_risco: Number(e.target.value) })
              }
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
            >
              {[1, 2, 3, 4].map((g) => (
                <option key={g} value={g}>
                  Grau {g}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Status</label>
            <select
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as "Ativo" | "Inativa" })
              }
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
            >
              <option value="Ativo">Ativo</option>
              <option value="Inativa">Inativa</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Observação</label>
          <textarea
            value={form.observacao}
            onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            rows={3}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
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
            {mutation.isPending ? "Salvando..." : isEdit ? "Salvar" : "Criar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
