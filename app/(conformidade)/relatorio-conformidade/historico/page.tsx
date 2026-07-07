"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Search,
  ArrowLeft,
  Plus,
} from "lucide-react";
import { useRelatoriosConformidade } from "@/lib/hooks/useRelatoriosConformidade";
import { listarNRs } from "@/lib/conformidade/checklists";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { useCanCreate } from "@/lib/hooks/useUsuario";
import { useUnidadeFiltro } from "@/lib/hooks/useUnidadeFiltro";

export default function HistoricoConformidadePage() {
  const canCreate = useCanCreate();
  const { data: relatoriosAll = [], isLoading } = useRelatoriosConformidade();
  const { data: empresas = [] } = useEmpresas();
  const { inUnidade } = useUnidadeFiltro();
  const relatorios = useMemo(() => relatoriosAll.filter((r) => inUnidade(r.id_empresa)), [relatoriosAll, inUnidade]);
  const nrs = useMemo(() => listarNRs(), []);

  const [q, setQ] = useState("");
  const [nrFilter, setNrFilter] = useState<string>("todas");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  const empresaMap = useMemo(() => {
    const m = new Map<string, string>();
    empresas.forEach((e) => m.set(e.id_empresa, e.nome_empresa));
    return m;
  }, [empresas]);

  const filtrados = useMemo(() => {
    const termo = q.trim().toLowerCase();
    return relatorios.filter((r) => {
      if (nrFilter !== "todas" && r.nr_codigo !== nrFilter) return false;
      if (statusFilter !== "todos" && r.status !== statusFilter) return false;
      if (!termo) return true;
      const empresaNome = empresaMap.get(r.id_empresa) ?? "";
      return (
        r.nr_codigo.toLowerCase().includes(termo) ||
        r.nr_titulo.toLowerCase().includes(termo) ||
        (r.setor ?? "").toLowerCase().includes(termo) ||
        (r.responsavel ?? "").toLowerCase().includes(termo) ||
        empresaNome.toLowerCase().includes(termo)
      );
    });
  }, [relatorios, q, nrFilter, statusFilter, empresaMap]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href="/relatorio-conformidade"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-verde-primary"
        >
          <ArrowLeft className="size-3.5" /> Voltar
        </Link>
        {canCreate && (
          <Link
            href="/relatorio-conformidade/novo"
            className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent"
          >
            <Plus className="size-4" /> Novo relatório
          </Link>
        )}
      </div>

      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <CheckCircle2 className="size-5 text-teal-600" />
          Histórico de Relatórios de Conformidade
        </h1>
        <p className="text-sm text-gray-600">
          {isLoading ? "Carregando..." : `${relatorios.length} relatório(s) registrado(s)`}
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por NR, empresa, setor ou responsável..."
            className="w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary"
          />
        </div>
        <select
          value={nrFilter}
          onChange={(e) => setNrFilter(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary"
        >
          <option value="todas">Todas as NRs</option>
          {nrs.map((nr) => (
            <option key={nr.codigo} value={nr.codigo}>
              {nr.codigo}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary"
        >
          <option value="todos">Todos os status</option>
          <option value="RASCUNHO">Rascunho</option>
          <option value="FINALIZADO">Finalizado</option>
        </select>
      </div>

      {/* Lista */}
      {filtrados.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
          {relatorios.length === 0
            ? "Nenhum relatório de conformidade criado ainda."
            : "Nenhum relatório encontrado com esses filtros."}
        </div>
      ) : (
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm reveal-up card-hover">
          {filtrados.map((r) => (
            <Link
              key={r.id_relatorio}
              href={`/relatorio-conformidade/${r.id_relatorio}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
            >
              <CheckCircle2 className="size-4 shrink-0 text-teal-600" />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {r.nr_codigo} — {empresaMap.get(r.id_empresa) ?? "—"}
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
                  {r.nr_titulo}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-gray-400">
                  {r.setor ? `Setor: ${r.setor}` : "Sem setor"}
                  {r.responsavel ? ` · Resp: ${r.responsavel}` : ""}
                  {r.data_inspecao
                    ? ` · ${new Date(r.data_inspecao + "T00:00").toLocaleDateString("pt-BR")}`
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
