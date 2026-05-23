"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Plus, ClipboardList, ChartBar, Search } from "lucide-react";
import { Suspense } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import InspecaoRow from "@/components/inspecoes/InspecaoRow";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import Pagination from "@/components/ui/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  useInspecoesPaginadas,
  type FiltroInspecao,
  type OrdemInspecao,
} from "@/lib/hooks/useInspecao";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import { useCanCreate, useCanDelete } from "@/lib/hooks/useUsuario";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Inspecao } from "@/lib/supabase/types";

const PAGE_SIZE = 20;

const FILTROS: { value: FiltroInspecao; label: string }[] = [
  { value: "Todos", label: "Todos" },
  { value: "RASCUNHO", label: "Rascunho" },
  { value: "EM_ANDAMENTO", label: "Em Andamento" },
  { value: "CONCLUIDA", label: "Concluídas" },
];

const ORDENS: { value: OrdemInspecao; label: string }[] = [
  { value: "recentes", label: "Mais recentes" },
  { value: "antigas", label: "Mais antigas" },
  { value: "revisao", label: "Por revisão" },
];

export default function InspecoesPage() {
  return (
    <Suspense fallback={null}>
      <InspecoesInner />
    </Suspense>
  );
}

function InspecoesInner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const canCreate = useCanCreate();
  const canDelete = useCanDelete();
  const qc = useQueryClient();
  const [confirmDel, setConfirmDel] = useState<Inspecao | null>(null);

  const delInsp = useMutation({
    mutationFn: async (insp: Inspecao) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("inspecoes")
        .update({ status: "DELETADA", updated_at: new Date().toISOString() } as never)
        .eq("id_inspecao", insp.id_inspecao);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspecoes"] });
      qc.invalidateQueries({ queryKey: ["inspecoes-lista"] });
      qc.invalidateQueries({ queryKey: ["inspecoes-counts"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Inspeção excluída");
      setConfirmDel(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const empresaParam = params.get("empresa");
  const [empresaId, setEmpresaId] = useState<string | null>(empresaParam);
  const [filtro, setFiltro] = useState<FiltroInspecao>("Todos");
  const [ordem, setOrdem] = useState<OrdemInspecao>("recentes");
  const [buscaTecnico, setBuscaTecnico] = useState("");
  const [page, setPage] = useState(1);

  // Reseta para página 1 quando qualquer filtro muda
  useEffect(() => { setPage(1); }, [empresaId, filtro, ordem, buscaTecnico]);

  // Sincroniza empresa na URL para deep-linking
  useEffect(() => {
    const sp = new URLSearchParams(params.toString());
    if (empresaId) sp.set("empresa", empresaId);
    else sp.delete("empresa");
    const next = sp.toString();
    router.replace(`${pathname}${next ? "?" + next : ""}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const { data: empresa } = useEmpresa(empresaId);
  const { lista, counts } = useInspecoesPaginadas({
    idEmpresa: empresaId,
    tecnico: buscaTecnico,
    filtro,
    ordem,
    page,
    pageSize: PAGE_SIZE,
  });

  const items = lista.data?.items ?? [];
  const total = lista.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isLoading = lista.isLoading;
  const isFetching = lista.isFetching;
  const countData = counts.data;

  const enabled = !!empresaId || buscaTecnico.trim().length >= 2;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex-1 max-w-xl">
          <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Empresa
          </label>
          <EmpresaSelect value={empresaId} onChange={setEmpresaId} modulo="sst" />
        </div>
        <div className="flex gap-2">
          {empresaId && (
            <Link
              href={`/empresas/${empresaId}/relatorio`}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              title="Relatório consolidado"
            >
              <ChartBar className="size-4" />
              Consolidado
            </Link>
          )}
          {canCreate && (
            <Link
              href={empresaId ? `/inspecoes/nova?empresa=${empresaId}` : "/inspecoes/nova"}
              className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-verde-accent"
            >
              <Plus className="size-4" />
              Nova Inspeção
            </Link>
          )}
        </div>
      </div>

      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por técnico..."
          value={buscaTecnico}
          onChange={(e) => setBuscaTecnico(e.target.value)}
          className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
        />
      </div>

      {empresaId && empresa && (
        <div className="rounded-lg border border-verde-border bg-verde-light px-4 py-2 text-sm text-verde-dark">
          Mostrando inspeções de <strong>{empresa.nome_empresa}</strong>
        </div>
      )}

      {empresaId && (
        <div className="flex flex-wrap items-center gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFiltro(f.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filtro === f.value
                  ? "border-verde-primary bg-verde-primary text-white"
                  : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
              )}
            >
              {f.label}
              {countData && (
                <span className="ml-1.5 opacity-75">({countData[f.value]})</span>
              )}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <label className="text-xs text-gray-500">Ordenar:</label>
            <select
              value={ordem}
              onChange={(e) => setOrdem(e.target.value as OrdemInspecao)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
            >
              {ORDENS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className={cn("overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm", isFetching && "opacity-70 transition-opacity")}>
        {!enabled ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <ClipboardList className="size-10 text-gray-400" />
            <p className="mt-3 text-sm font-medium text-gray-900">
              Selecione uma empresa ou busque pelo técnico
            </p>
            <p className="text-xs text-gray-500">
              Digite ao menos 2 caracteres no campo acima para buscar por técnico
            </p>
          </div>
        ) : isLoading ? (
          <div className="p-4">
            <LoadingSkeleton rows={6} />
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">
            Nenhuma inspeção {filtro !== "Todos" ? "nesse status" : "encontrada"}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">ID</th>
                  {!empresaId && (
                    <th className="px-4 py-2.5 text-left font-medium">Empresa</th>
                  )}
                  <th className="px-4 py-2.5 text-center font-medium">Rev.</th>
                  <th className="px-4 py-2.5 text-left font-medium">Data</th>
                  <th className="px-4 py-2.5 text-left font-medium">Responsável</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((i) => (
                  <InspecaoRow
                    key={i.id_inspecao}
                    insp={i}
                    onDelete={canDelete ? setConfirmDel : undefined}
                    showEmpresa={!empresaId}
                  />
                ))}
              </tbody>
            </table>
            {total > PAGE_SIZE && (
              <Pagination
                page={page}
                totalPages={totalPages}
                totalItems={total}
                pageSize={PAGE_SIZE}
                onChange={setPage}
              />
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDel}
        title="Excluir inspeção?"
        description={
          confirmDel
            ? `A inspeção ${confirmDel.id_inspecao} (rev. ${confirmDel.revisao}) será marcada como excluída. Ela não aparecerá mais na lista, mas o histórico fica preservado no banco.`
            : undefined
        }
        variant="danger"
        loading={delInsp.isPending}
        onConfirm={() => confirmDel && delInsp.mutate(confirmDel)}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}
