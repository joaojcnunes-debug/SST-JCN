"use client";

import { useMemo, useState } from "react";
import {
  Target,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  Building2,
  Layers,
  AlertTriangle,
  Search,
} from "lucide-react";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { useAcoes, useDeleteAcao } from "@/lib/hooks/useAcoes";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import { usePagination } from "@/lib/hooks/usePagination";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import Pagination from "@/components/ui/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import AcaoForm from "@/components/acoes/AcaoForm";
import { fmtData, cn } from "@/lib/utils";
import type {
  Acao5W2H,
  AcaoPrioridade,
  AcaoStatus,
} from "@/lib/supabase/types";

const STATUS_CFG: Record<
  AcaoStatus,
  { label: string; border: string; bg: string; text: string }
> = {
  Pendente: {
    label: "Pendente",
    border: "border-gray-300",
    bg: "bg-gray-100",
    text: "text-gray-700",
  },
  "Em Andamento": {
    label: "Em Andamento",
    border: "border-blue-300",
    bg: "bg-blue-100",
    text: "text-blue-800",
  },
  Concluida: {
    label: "Concluída",
    border: "border-green-300",
    bg: "bg-green-100",
    text: "text-green-800",
  },
  Cancelada: {
    label: "Cancelada",
    border: "border-red-300",
    bg: "bg-red-100",
    text: "text-red-800",
  },
};

const PRIORIDADE_CFG: Record<
  AcaoPrioridade,
  { label: string; bg: string; text: string }
> = {
  Baixa: { label: "Baixa", bg: "bg-slate-100", text: "text-slate-700" },
  Media: { label: "Média", bg: "bg-amber-100", text: "text-amber-800" },
  Alta: { label: "Alta", bg: "bg-orange-100", text: "text-orange-800" },
  Critica: { label: "Crítica", bg: "bg-red-100", text: "text-red-800" },
};

export default function AcoesPage() {
  const canEdit = useCanEdit();
  const { data: empresas = [] } = useEmpresas();
  const { data: acoes = [], isLoading } = useAcoes();
  const del = useDeleteAcao();

  const [busca, setBusca] = useState("");
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>("");
  const [filtroStatus, setFiltroStatus] = useState<AcaoStatus | "">("");
  const [filtroPrior, setFiltroPrior] = useState<AcaoPrioridade | "">("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Acao5W2H | null>(null);
  const [confirmDel, setConfirmDel] = useState<Acao5W2H | null>(null);

  const empresaPorId = useMemo(
    () => new Map(empresas.map((e) => [e.id_empresa, e.nome_empresa])),
    [empresas]
  );

  const filtradas = useMemo(() => {
    let arr = acoes;
    if (filtroEmpresa) arr = arr.filter((a) => a.id_empresa === filtroEmpresa);
    if (filtroStatus) arr = arr.filter((a) => a.status === filtroStatus);
    if (filtroPrior) arr = arr.filter((a) => a.prioridade === filtroPrior);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      arr = arr.filter(
        (a) =>
          a.what_acao.toLowerCase().includes(q) ||
          (a.who_responsavel ?? "").toLowerCase().includes(q) ||
          (a.where_local ?? "").toLowerCase().includes(q)
      );
    }
    return arr;
  }, [acoes, filtroEmpresa, filtroStatus, filtroPrior, busca]);

  const pag = usePagination({
    data: filtradas,
    pageSize: 20,
    resetKey: `${filtroEmpresa}|${filtroStatus}|${filtroPrior}|${busca}`,
  });

  // Contagens por status pra mostrar nas pills de filtro
  const counts = useMemo(() => {
    const acc: Record<AcaoStatus | "Total", number> = {
      Total: acoes.length,
      Pendente: 0,
      "Em Andamento": 0,
      Concluida: 0,
      Cancelada: 0,
    };
    for (const a of acoes) acc[a.status]++;
    return acc;
  }, [acoes]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Target className="size-6 text-verde-primary" />
            Plano de Ação
          </h1>
          <p className="text-sm text-gray-600">
            Tabela 5W2H · {counts.Total} ação(ões) cadastrada(s)
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-verde-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-verde-accent active:scale-95"
          >
            <Plus className="size-4" /> Nova Ação
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_180px_160px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar ação, responsável ou local..."
              className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
            />
          </div>
          <select
            value={filtroEmpresa}
            onChange={(e) => setFiltroEmpresa(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          >
            <option value="">Todas as empresas</option>
            {empresas.map((e) => (
              <option key={e.id_empresa} value={e.id_empresa}>
                {e.nome_empresa}
              </option>
            ))}
          </select>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as AcaoStatus | "")}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          >
            <option value="">Todos status</option>
            {(Object.keys(STATUS_CFG) as AcaoStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_CFG[s].label} ({counts[s]})
              </option>
            ))}
          </select>
          <select
            value={filtroPrior}
            onChange={(e) =>
              setFiltroPrior(e.target.value as AcaoPrioridade | "")
            }
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          >
            <option value="">Toda prioridade</option>
            {(Object.keys(PRIORIDADE_CFG) as AcaoPrioridade[]).map((p) => (
              <option key={p} value={p}>
                {PRIORIDADE_CFG[p].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div className="reveal-up overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-5">
            <LoadingSkeleton rows={5} />
          </div>
        ) : filtradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-14 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-verde-light">
              <Target className="size-7 text-verde-primary" />
            </div>
            <p className="mt-4 text-sm font-semibold text-gray-800">
              {acoes.length === 0 ? "Nenhuma ação cadastrada ainda" : "Nenhuma ação encontrada"}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {acoes.length === 0 ? "Crie a primeira ação 5W2H" : "Tente ajustar os filtros"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Ação (O quê)</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Empresa / Setor</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Responsável</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Prazo</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Prioridade</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Status</th>
                  <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pag.pageItems.map((a) => {
                  const sCfg = STATUS_CFG[a.status];
                  const pCfg = PRIORIDADE_CFG[a.prioridade];
                  return (
                    <tr key={a.id_acao} className="border-b border-gray-50 transition-colors hover:bg-verde-light/25 last:border-b-0">
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-gray-900">{a.what_acao}</p>
                        {a.why_justificativa && (
                          <p className="mt-0.5 text-[11px] text-gray-500">
                            <em>Por quê:</em> {a.why_justificativa}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        <div className="flex items-center gap-1 text-gray-700">
                          <Building2 className="size-3.5 text-gray-400" />
                          {empresaPorId.get(a.id_empresa) ?? a.id_empresa}
                        </div>
                        {a.where_local && (
                          <div className="mt-0.5 flex items-center gap-1 text-gray-500">
                            <Layers className="size-3.5 text-gray-400" />
                            {a.where_local}
                          </div>
                        )}
                        {a.id_risco && (
                          <div className="mt-0.5 flex items-center gap-1 text-red-700">
                            <AlertTriangle className="size-3.5" />
                            Risco vinculado
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-gray-700">
                        {a.who_responsavel ?? "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        {a.when_prazo ? (
                          <div className="inline-flex items-center gap-1 text-gray-700">
                            <Calendar className="size-3.5 text-gray-400" />
                            {fmtData(a.when_prazo)}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            pCfg.bg,
                            pCfg.text
                          )}
                        >
                          {pCfg.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                            sCfg.border,
                            sCfg.bg,
                            sCfg.text
                          )}
                        >
                          {sCfg.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-1">
                          {canEdit && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditing(a);
                                  setFormOpen(true);
                                }}
                                className="flex size-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-verde-light hover:text-verde-primary"
                                title="Editar"
                              >
                                <Pencil className="size-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDel(a)}
                                className="flex size-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                                title="Excluir"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

      <AcaoForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        editing={editing}
      />

      <ConfirmDialog
        open={!!confirmDel}
        title="Excluir ação?"
        description={
          confirmDel
            ? `"${confirmDel.what_acao}" será removida permanentemente.`
            : undefined
        }
        variant="danger"
        loading={del.isPending}
        onConfirm={() => confirmDel && del.mutate(confirmDel.id_acao)}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}
