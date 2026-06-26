"use client";

import { useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Search, Building2, UploadCloud } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { useUnidades } from "@/lib/hooks/useUnidades";
import { excluirComLixeira } from "@/lib/hooks/useLixeira";
import EmpresaCard from "@/components/empresas/EmpresaCard";
import EmpresaForm from "@/components/empresas/EmpresaForm";
import ImportarEmpresasModal from "@/components/empresas/ImportarEmpresasModal";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useCanCreate, useCanDelete, useCanEdit } from "@/lib/hooks/useUsuario";
import type { Empresa } from "@/lib/supabase/types";

function EmpresasInner() {
  const searchParams = useSearchParams();
  const { data: empresas = [], isLoading, error } = useEmpresas();
  const { data: unidades = [] } = useUnidades();
  const canEdit = useCanEdit();
  const canCreate = useCanCreate();
  const canDelete = useCanDelete();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  // Pré-filtra por unidade quando vem da "Visão geral" (/empresas?unidade=ID|__sem__).
  const [filtroUnidade, setFiltroUnidade] = useState(searchParams.get("unidade") ?? "");
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Empresa | null>(null);
  const [confirmDel, setConfirmDel] = useState<Empresa | null>(null);

  const delEmpresa = useMutation({
    mutationFn: async (e: Empresa) => {
      // Exclusão com lixeira: salva snapshot recuperável + audita, depois exclui.
      // (FKs ON DELETE CASCADE ainda limpam os filhos — restauração traz a
      // empresa de volta; filhos em cascata não são restaurados.)
      await excluirComLixeira({
        tabela: "empresas",
        chave: "id_empresa",
        id: e.id_empresa,
        dados: e as unknown as Record<string, unknown>,
        rotulo: e.nome_empresa,
        modulo: "empresas",
      });
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
    const q = busca.trim().toLowerCase();
    return empresas.filter((e) => {
      if (filtroUnidade === "__sem__" && e.id_unidade) return false;
      if (filtroUnidade && filtroUnidade !== "__sem__" && e.id_unidade !== filtroUnidade) return false;
      if (!q) return true;
      return (
        e.nome_empresa.toLowerCase().includes(q) ||
        (e.cnpj ?? "").toLowerCase().includes(q) ||
        (e.razao_social ?? "").toLowerCase().includes(q)
      );
    });
  }, [empresas, busca, filtroUnidade]);

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
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm transition focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20"
          />
        </div>
        {unidades.length > 0 && (
          <select
            value={filtroUnidade}
            onChange={(e) => setFiltroUnidade(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm shadow-sm transition focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20"
            title="Filtrar por unidade"
          >
            <option value="">Todas as unidades</option>
            {unidades.map((u) => (
              <option key={u.id_unidade} value={u.id_unidade}>{u.nome}</option>
            ))}
            <option value="__sem__">Sem unidade</option>
          </select>
        )}
        {canCreate && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-95"
            >
              <UploadCloud className="size-4" />
              Importar
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-verde-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-verde-accent active:scale-95"
            >
              <Plus className="size-4" />
              Nova Empresa
            </button>
          </div>
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
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-14 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-verde-light">
            <Building2 className="size-7 text-verde-primary" />
          </div>
          <p className="mt-4 text-sm font-semibold text-gray-800">
            Nenhuma empresa {busca ? "encontrada" : "cadastrada"}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {busca ? `Nenhum resultado para "${busca}"` : "Comece cadastrando a primeira empresa"}
          </p>
          {!busca && canEdit && (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-verde-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-verde-accent"
            >
              <Plus className="size-4" />
              Cadastrar empresa
            </button>
          )}
        </div>
      )}

      {!isLoading && !error && filtradas.length > 0 && (
        <div className="reveal-up grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      <ImportarEmpresasModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        empresas={empresas}
        unidades={unidades}
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

export default function EmpresasPage() {
  // useSearchParams exige Suspense boundary (padrão do projeto).
  return (
    <Suspense fallback={null}>
      <EmpresasInner />
    </Suspense>
  );
}
