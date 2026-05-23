"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, BookOpen, ArrowRight, Loader2 } from "lucide-react";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { useQpsAplicacoes } from "@/lib/hooks/useQuestionarios";
import { useQpsTipos } from "@/lib/hooks/useQuestionarios";
import type { QpsAplicacao, StatusQpsAplicacao } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<StatusQpsAplicacao, string> = {
  RASCUNHO: "Rascunho",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDO: "Concluído",
  DELETADO: "Deletado",
};

const STATUS_COR: Record<StatusQpsAplicacao, string> = {
  RASCUNHO: "bg-gray-100 text-gray-600",
  EM_ANDAMENTO: "bg-blue-100 text-blue-700",
  CONCLUIDO: "bg-green-100 text-green-700",
  DELETADO: "bg-red-100 text-red-600",
};

function fmtData(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function QpsListaPage() {
  const [idEmpresa, setIdEmpresa] = useState<string>("");

  const { data: empresas = [], isLoading: loadingEmpresas } = useEmpresas();
  const { data: tipos = [] } = useQpsTipos();
  const {
    data: aplicacoes = [],
    isLoading: loadingAplicacoes,
    isError,
  } = useQpsAplicacoes(idEmpresa || null);

  const tiposMap = Object.fromEntries(tipos.map((t) => [t.id_tipo, t.nome]));

  const contadores = {
    total: aplicacoes.length,
    rascunho: aplicacoes.filter((a) => a.status === "RASCUNHO").length,
    em_andamento: aplicacoes.filter((a) => a.status === "EM_ANDAMENTO").length,
    concluido: aplicacoes.filter((a) => a.status === "CONCLUIDO").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="size-5 text-indigo-600" />
            Aplicações DRPS
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Questionários psicossociais aplicados por empresa
          </p>
        </div>
        <Link
          href="/questionarios-psicossociais/nova"
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          <Plus className="size-4" /> Nova Aplicação
        </Link>
      </div>

      {/* Filtro de empresa */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Empresa
        </label>
        {loadingEmpresas ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="size-4 animate-spin" /> Carregando empresas...
          </div>
        ) : (
          <select
            value={idEmpresa}
            onChange={(e) => setIdEmpresa(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:max-w-xs"
          >
            <option value="">Selecione uma empresa</option>
            {empresas.map((e) => (
              <option key={e.id_empresa} value={e.id_empresa}>
                {e.nome_empresa}
              </option>
            ))}
          </select>
        )}
      </div>

      {idEmpresa && (
        <>
          {/* Contadores */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total" value={contadores.total} color="indigo" />
            <StatCard label="Rascunho" value={contadores.rascunho} color="gray" />
            <StatCard label="Em andamento" value={contadores.em_andamento} color="blue" />
            <StatCard label="Concluído" value={contadores.concluido} color="green" />
          </div>

          {/* Tabela */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            {loadingAplicacoes ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
                <Loader2 className="size-4 animate-spin" /> Carregando...
              </div>
            ) : isError ? (
              <p className="py-12 text-center text-sm text-red-600">
                Erro ao carregar aplicações.
              </p>
            ) : aplicacoes.length === 0 ? (
              <div className="py-12 text-center">
                <BookOpen className="mx-auto size-10 text-gray-300" />
                <p className="mt-3 text-sm font-medium text-gray-600">
                  Nenhuma aplicação encontrada
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Crie a primeira aplicação para esta empresa
                </p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Título</th>
                    <th className="hidden px-4 py-3 text-left font-semibold sm:table-cell">Tipo</th>
                    <th className="hidden px-4 py-3 text-left font-semibold md:table-cell">Responsável</th>
                    <th className="hidden px-4 py-3 text-left font-semibold lg:table-cell">Período</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {aplicacoes.map((a) => (
                    <AplicacaoRow key={a.id_aplicacao} ap={a} tiposMap={tiposMap} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {!idEmpresa && !loadingEmpresas && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-16 text-center text-sm text-gray-400">
          Selecione uma empresa para ver as aplicações
        </div>
      )}
    </div>
  );
}

function AplicacaoRow({
  ap,
  tiposMap,
}: {
  ap: QpsAplicacao;
  tiposMap: Record<string, string>;
}) {
  return (
    <tr className="group hover:bg-gray-50">
      <td className="px-4 py-3 font-medium text-gray-900">{ap.titulo}</td>
      <td className="hidden px-4 py-3 text-gray-600 sm:table-cell">
        {tiposMap[ap.id_tipo] ?? "—"}
      </td>
      <td className="hidden px-4 py-3 text-gray-500 md:table-cell">
        {ap.responsavel ?? "—"}
      </td>
      <td className="hidden px-4 py-3 text-gray-500 lg:table-cell">
        {ap.periodo_inicio
          ? `${fmtData(ap.periodo_inicio)} – ${fmtData(ap.periodo_fim)}`
          : "—"}
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-semibold",
            STATUS_COR[ap.status]
          )}
        >
          {STATUS_LABEL[ap.status]}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`/questionarios-psicossociais/${ap.id_aplicacao}`}
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
        >
          Abrir <ArrowRight className="size-3" />
        </Link>
      </td>
    </tr>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "indigo" | "gray" | "blue" | "green";
}) {
  const colors = {
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
    gray: "border-gray-200 bg-gray-50 text-gray-600",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-green-200 bg-green-50 text-green-700",
  };
  return (
    <div className={cn("rounded-xl border p-4 text-center", colors[color])}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-0.5 text-xs font-medium">{label}</p>
    </div>
  );
}
