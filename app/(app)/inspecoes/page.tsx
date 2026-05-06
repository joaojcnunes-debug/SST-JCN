"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Plus, ClipboardList } from "lucide-react";
import { Suspense } from "react";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import InspecaoRow from "@/components/inspecoes/InspecaoRow";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import Pagination from "@/components/ui/Pagination";
import { useInspecoesByEmpresa } from "@/lib/hooks/useInspecao";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import { usePagination } from "@/lib/hooks/usePagination";
import { cn } from "@/lib/utils";
import type { StatusInspecao } from "@/lib/supabase/types";

type Filtro = "Todos" | StatusInspecao;
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
  const empresaParam = params.get("empresa");
  const [empresaId, setEmpresaId] = useState<string | null>(empresaParam);
  const [filtro, setFiltro] = useState<Filtro>("Todos");
  const [ordem, setOrdem] = useState<Ordem>("recentes");

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
  const { data: inspecoes = [], isLoading } = useInspecoesByEmpresa(empresaId);

  const lista = useMemo(() => {
    let arr = [...inspecoes];
    if (filtro !== "Todos") arr = arr.filter((i) => i.status === filtro);
    arr.sort((a, b) => {
      if (ordem === "recentes")
        return (b.created_at ?? "").localeCompare(a.created_at ?? "");
      if (ordem === "antigas")
        return (a.created_at ?? "").localeCompare(b.created_at ?? "");
      return (b.revisao ?? 0) - (a.revisao ?? 0);
    });
    return arr;
  }, [inspecoes, filtro, ordem]);

  const pag = usePagination({
    data: lista,
    pageSize: 20,
    resetKey: `${empresaId}|${filtro}|${ordem}`,
  });

  const counts = useMemo(() => {
    const acc: Record<Filtro, number> = {
      Todos: inspecoes.length,
      RASCUNHO: 0,
      EM_ANDAMENTO: 0,
      CONCLUIDA: 0,
    };
    for (const i of inspecoes) acc[i.status]++;
    return acc;
  }, [inspecoes]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex-1 max-w-xl">
          <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Empresa
          </label>
          <EmpresaSelect value={empresaId} onChange={setEmpresaId} />
        </div>
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
        {!empresaId ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <ClipboardList className="size-10 text-gray-400" />
            <p className="mt-3 text-sm font-medium text-gray-900">
              Selecione uma empresa
            </p>
            <p className="text-xs text-gray-500">
              Escolha uma empresa para ver suas inspeções
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
                  <th className="px-4 py-2.5 text-center font-medium">Rev.</th>
                  <th className="px-4 py-2.5 text-left font-medium">Data</th>
                  <th className="px-4 py-2.5 text-left font-medium">Responsável</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pag.pageItems.map((i) => (
                  <InspecaoRow key={i.id_inspecao} insp={i} />
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
    </div>
  );
}
