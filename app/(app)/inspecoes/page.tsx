"use client";

import { useEffect, useMemo, useState } from "react";
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
import { useInspecoesByEmpresa, useInspecoesByTecnico } from "@/lib/hooks/useInspecao";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import { useCanCreate, useCanDelete } from "@/lib/hooks/useUsuario";
import { usePagination } from "@/lib/hooks/usePagination";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Inspecao } from "@/lib/supabase/types";

type Filtro = "Todos" | "RASCUNHO" | "EM_ANDAMENTO" | "CONCLUIDA";
type Ordem = "recentes" | "antigas" | "revisao";

const FILTROS: { value: Filtro; label: string }[] = [
  { value: "Todos", label: "Todos" },
  { value: "RASCUNHO", label: "Rascunho" },
  { value: "EM_ANDAMENTO", label: "Em Andamento" },
  { value: "CONCLUIDA", label: "Concluídas" },
];

const ORDENS: { value: Ordem; label: string }[] = [
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
      // Soft delete: marca como DELETADA (a lista já filtra esse status)
      const { error } = await supabase
        .from("inspecoes")
        .update({ status: "DELETADA", updated_at: new Date().toISOString() } as never)
        .eq("id_inspecao", insp.id_inspecao);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspecoes"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Inspeção excluída");
      setConfirmDel(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const empresaParam = params.get("empresa");
  const [empresaId, setEmpresaId] = useState<string | null>(empresaParam);
  const [filtro, setFiltro] = useState<Filtro>("Todos");
  const [ordem, setOrdem] = useState<Ordem>("recentes");
  const [buscaTecnico, setBuscaTecnico] = useState("");

  // Mantém URL sincronizada para deep-linking
  useEffect(() => {
    const sp = new URLSearchParams(params.toString());
    if (empresaId) sp.set("empresa", empresaId);
    else sp.delete("empresa");
    const next = sp.toString();
    router.replace(`${pathname}${next ? "?" + next : ""}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const { data: empresa } = useEmpresa(empresaId);
  const { data: inspecoesByEmpresa = [], isLoading: loadingEmpresa } = useInspecoesByEmpresa(empresaId);
  const { data: inspecoesByTecnico = [], isLoading: loadingTecnico } = useInspecoesByTecnico(empresaId ? "" : buscaTecnico);

  // Se empresa selecionada: usa dados da empresa; senão usa busca por técnico
  const inspecoes = empresaId ? inspecoesByEmpresa : inspecoesByTecnico;
  const isLoading = empresaId ? loadingEmpresa : loadingTecnico;

  const lista = useMemo(() => {
    // Por padrão, ocultar inspeções DELETADA da lista visual.
    let arr = inspecoes.filter((i) => i.status !== "DELETADA");
    if (filtro !== "Todos") arr = arr.filter((i) => i.status === filtro);
    if (buscaTecnico.trim()) {
      const termo = buscaTecnico.trim().toLowerCase();
      arr = arr.filter((i) => i.responsavel?.toLowerCase().includes(termo));
    }
    arr.sort((a, b) => {
      if (ordem === "recentes")
        return (b.created_at ?? "").localeCompare(a.created_at ?? "");
      if (ordem === "antigas")
        return (a.created_at ?? "").localeCompare(b.created_at ?? "");
      return (b.revisao ?? 0) - (a.revisao ?? 0);
    });
    return arr;
  }, [inspecoes, filtro, ordem, buscaTecnico]);

  const pag = usePagination({
    data: lista,
    pageSize: 20,
    resetKey: `${empresaId}|${filtro}|${ordem}|${buscaTecnico}`,
  });

  const counts = useMemo(() => {
    const visiveis = inspecoes.filter((i) => i.status !== "DELETADA");
    const acc: Record<Filtro, number> = {
      Todos: visiveis.length,
      RASCUNHO: 0,
      EM_ANDAMENTO: 0,
      CONCLUIDA: 0,
    };
    for (const i of visiveis) {
      if (i.status === "RASCUNHO" || i.status === "EM_ANDAMENTO" || i.status === "CONCLUIDA") {
        acc[i.status]++;
      }
    }
    return acc;
  }, [inspecoes]);

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
              href={
                empresaId
                  ? `/inspecoes/nova?empresa=${empresaId}`
                  : "/inspecoes/nova"
              }
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
              <span className="ml-1.5 opacity-75">({counts[f.value]})</span>
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <label className="text-xs text-gray-500">Ordenar:</label>
            <select
              value={ordem}
              onChange={(e) => setOrdem(e.target.value as Ordem)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
            >
              {ORDENS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {!empresaId && buscaTecnico.trim().length < 2 ? (
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
        ) : lista.length === 0 ? (
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
                {pag.pageItems.map((i) => (
                  <InspecaoRow
                    key={i.id_inspecao}
                    insp={i}
                    onDelete={canDelete ? setConfirmDel : undefined}
                    showEmpresa={!empresaId}
                  />
                ))}
              </tbody>
            </table>
            {pag.showPagination && (
              <Pagination
                page={pag.page}
                totalPages={pag.totalPages}
                totalItems={pag.totalItems}
                pageSize={pag.pageSize}
                onChange={pag.setPage}
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
