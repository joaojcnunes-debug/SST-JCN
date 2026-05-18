"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import {
  type Empresa,
  type ModuloEmpresa,
  MODULOS_EMPRESA,
} from "@/lib/supabase/types";

const DEFAULT_MODULOS: ModuloEmpresa[] = [
  "sst",
  "psicossocial",
  "conformidade",
  "analise_quimicos",
];

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
    cpf: "",
    cei: "",
    caepf: "",
    cno: "",
    status: "Ativo" as "Ativo" | "Inativa",
    observacao: "",
    modulos_habilitados: [...DEFAULT_MODULOS] as ModuloEmpresa[],
  });

  useEffect(() => {
    if (open) {
      setForm({
        nome_empresa: empresa?.nome_empresa ?? "",
        razao_social: empresa?.razao_social ?? "",
        cnpj: empresa?.cnpj ?? "",
        cpf: empresa?.cpf ?? "",
        cei: empresa?.cei ?? "",
        caepf: empresa?.caepf ?? "",
        cno: empresa?.cno ?? "",
        status: (empresa?.status as "Ativo" | "Inativa") ?? "Ativo",
        observacao: empresa?.observacao ?? "",
        modulos_habilitados:
          empresa?.modulos_habilitados && empresa.modulos_habilitados.length > 0
            ? [...empresa.modulos_habilitados]
            : [...DEFAULT_MODULOS],
      });
    }
  }, [open, empresa]);

  function toggleModulo(m: ModuloEmpresa) {
    setForm((f) => {
      const existe = f.modulos_habilitados.includes(m);
      return {
        ...f,
        modulos_habilitados: existe
          ? f.modulos_habilitados.filter((x) => x !== m)
          : [...f.modulos_habilitados, m],
      };
    });
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const payload = {
        nome_empresa: form.nome_empresa.trim(),
        razao_social: form.razao_social.trim() || null,
        cnpj: form.cnpj.replace(/\D/g, "") || null,
        cpf: form.cpf.replace(/\D/g, "") || null,
        cei: form.cei.replace(/\D/g, "") || null,
        caepf: form.caepf.replace(/\D/g, "") || null,
        cno: form.cno.replace(/\D/g, "") || null,
        status: form.status,
        observacao: form.observacao.trim() || null,
        modulos_habilitados: form.modulos_habilitados,
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

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Identificadores alternativos (opcionais)
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-gray-700">CPF</label>
              <input
                type="text"
                value={form.cpf}
                onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                placeholder="000.000.000-00"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">CEI</label>
              <input
                type="text"
                value={form.cei}
                onChange={(e) => setForm({ ...form, cei: e.target.value })}
                placeholder="00.000.00000/00"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">CAEPF</label>
              <input
                type="text"
                value={form.caepf}
                onChange={(e) => setForm({ ...form, caepf: e.target.value })}
                placeholder="000.000.000/000-00"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">CNO</label>
              <input
                type="text"
                value={form.cno}
                onChange={(e) => setForm({ ...form, cno: e.target.value })}
                placeholder="00.000.00000/00"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              />
            </div>
          </div>
        </div>

        {/* Módulos habilitados — controla em quais quadros a empresa aparece */}
        <div className="rounded-lg border border-teal-200 bg-teal-50/40 p-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-teal-700">
            Módulos habilitados
          </p>
          <p className="mb-2 text-xs text-gray-600">
            Selecione em quais quadros esta empresa deve aparecer no seletor.
            Por padrão, novas empresas aparecem em todos.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {MODULOS_EMPRESA.map((m) => {
              const checked = form.modulos_habilitados.includes(m.value);
              return (
                <label
                  key={m.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                    checked
                      ? "border-teal-300 bg-white text-teal-900"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleModulo(m.value)}
                    className="size-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                  />
                  {m.label}
                </label>
              );
            })}
          </div>
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
