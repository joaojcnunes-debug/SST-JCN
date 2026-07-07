"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Search, ArrowLeft, Plus } from "lucide-react";
import { useRelatoriosNaoConformidade } from "@/lib/hooks/useRelatoriosNaoConformidade";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { useCanCreate } from "@/lib/hooks/useUsuario";
import { useUnidadeFiltro } from "@/lib/hooks/useUnidadeFiltro";

export default function HistoricoNaoConformidadePage() {
  const canCreate = useCanCreate();
  const { data: relatoriosAll = [], isLoading } = useRelatoriosNaoConformidade();
  const { data: empresas = [] } = useEmpresas();
  const { inUnidade } = useUnidadeFiltro();
  const relatorios = useMemo(() => relatoriosAll.filter((r) => inUnidade(r.id_empresa)), [relatoriosAll, inUnidade]);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  const empresaMap = useMemo(() => {
    const m = new Map<string, string>();
    empresas.forEach((e) => m.set(e.id_empresa, e.nome_empresa));
    return m;
  }, [empresas]);

  const filtrados = useMemo(() => {
    const termo = q.trim().toLowerCase();
    return relatorios.filter((r) => {
      if (statusFilter !== "todos" && r.status !== statusFilter) return false;
      if (!termo) return true;
      const empresaNome = empresaMap.get(r.id_empresa) ?? "";
      return (
        r.titulo.toLowerCase().includes(termo) ||
        (r.setor ?? "").toLowerCase().includes(termo) ||
        (r.responsavel ?? "").toLowerCase().includes(termo) ||
        empresaNome.toLowerCase().includes(termo)
      );
    });
  }, [relatorios, q, statusFilter, empresaMap]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href="/relatorio-nao-conformidade"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-verde-primary"
        >
          <ArrowLeft className="size-3.5" /> Voltar
        </Link>
        {canCreate && (
          <Link
            href="/relatorio-nao-conformidade/novo"
            className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
          >
            <Plus className="size-4" /> Novo relatório
          </Link>
        )}
      </div>

      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <AlertTriangle className="size-5 text-red-600" />
          Histórico de Relatórios de Não Conformidade
        </h1>
        <p className="text-sm text-gray-600">
          {isLoading
            ? "Carregando..."
            : `${relatorios.length} relatório(s) registrado(s)`}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título, empresa, setor ou responsável..."
            className="w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        >
          <option value="todos">Todos os status</option>
          <option value="RASCUNHO">Rascunho</option>
          <option value="FINALIZADO">Finalizado</option>
        </select>
      </div>

      {filtrados.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
          {relatorios.length === 0
            ? "Nenhum relatório criado ainda."
            : "Nenhum relatório encontrado com esses filtros."}
        </div>
      ) : (
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm reveal-up card-hover">
          {filtrados.map((r) => (
            <Link
              key={r.id_relatorio}
              href={`/relatorio-nao-conformidade/${r.id_relatorio}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
            >
              <AlertTriangle className="size-4 shrink-0 text-red-600" />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {r.titulo}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      r.status === "FINALIZADO"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {r.status === "FINALIZADO" ? "Finalizado" : "Rascunho"}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-gray-500">
                  {empresaMap.get(r.id_empresa) ?? "—"}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-gray-400">
                  {r.setor ? `Setor: ${r.setor}` : "Sem setor"}
                  {r.responsavel ? ` · Resp: ${r.responsavel}` : ""}
                  {r.data_inspecao
                    ? ` · ${new Date(
                        r.data_inspecao + "T00:00"
                      ).toLocaleDateString("pt-BR")}`
                    : ""}
                </p>
              </div>
              <span className="shrink-0 text-xs text-gray-500">
                {new Date(r.created_at).toLocaleDateString("pt-BR")}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
