"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Building2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import EmpresaCard from "@/components/empresas/EmpresaCard";
import EmpresaForm from "@/components/empresas/EmpresaForm";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useCanCreate, useCanDelete, useCanEdit } from "@/lib/hooks/useUsuario";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Empresa } from "@/lib/supabase/types";

export default function EmpresasPage() {
  const { data: empresas = [], isLoading, error } = useEmpresas();
  const canEdit = useCanEdit();
  const canCreate = useCanCreate();
  const canDelete = useCanDelete();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Empresa | null>(null);
  const [confirmDel, setConfirmDel] = useState<Empresa | null>(null);

  const delEmpresa = useMutation({
    mutationFn: async (e: Empresa) => {
      const supabase = createSupabaseBrowserClient();
      // Hard delete — FKs com ON DELETE CASCADE limpam todas as
      // inspeções, setores, riscos, etc da empresa.
      const { error } = await supabase
        .from("empresas")
        .delete()
        .eq("id_empresa", e.id_empresa);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empresas"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Empresa excluída");
      setConfirmDel(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtradas = useMemo(() => {
    if (!busca.trim()) return empresas;
    const q = busca.toLowerCase();
    return empresas.filter(
      (e) =>
        e.nome_empresa.toLowerCase().includes(q) ||
        (e.cnpj ?? "").toLowerCase().includes(q) ||
        (e.razao_social ?? "").toLowerCase().includes(q)
    );
  }, [empresas, busca]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou CNPJ..."
            className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          />
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-verde-accent"
          >
            <Plus className="size-4" />
            Nova Empresa
          </button>
        )}
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <LoadingSkeleton rows={1} className="h-44" />
          <LoadingSkeleton rows={1} className="h-44" />
          <LoadingSkeleton rows={1} className="h-44" />
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Erro ao carregar empresas: {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && filtradas.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <Building2 className="size-10 text-gray-400" />
          <p className="mt-3 text-sm font-medium text-gray-900">
            Nenhuma empresa {busca ? "encontrada" : "cadastrada"}
          </p>
          {!busca && canEdit && (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="mt-3 text-sm font-medium text-verde-primary hover:underline"
            >
              Cadastrar a primeira →
            </button>
          )}
        </div>
      )}

      {!isLoading && !error && filtradas.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtradas.map((empresa) => (
            <EmpresaCard
              key={empresa.id_empresa}
              empresa={empresa}
              canEdit={canEdit}
              onEdit={() => {
                setEditing(empresa);
                setFormOpen(true);
              }}
              onDelete={canDelete ? setConfirmDel : undefined}
            />
          ))}
        </div>
      )}

      <EmpresaForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        empresa={editing}
      />

      <ConfirmDialog
        open={!!confirmDel}
        title="Excluir empresa?"
        description={
          confirmDel
            ? `"${confirmDel.nome_empresa}" será excluída permanentemente, junto com TODAS as suas inspeções, setores, cargos, riscos, EPIs, fotos, responsáveis, PAE e treinamentos. Esta ação é irreversível.`
            : undefined
        }
        confirmLabel="Sim, excluir tudo"
        variant="danger"
        loading={delEmpresa.isPending}
        onConfirm={() => confirmDel && delEmpresa.mutate(confirmDel)}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}
