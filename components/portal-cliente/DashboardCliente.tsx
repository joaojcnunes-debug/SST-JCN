"use client";

import Link from "next/link";
import { FileText, ClipboardList, AlertTriangle, ListChecks, Clock, ArrowRight, Loader2 } from "lucide-react";
import { usePortalDashboardStats, usePortalEmpresa } from "@/lib/hooks/usePortalCliente";
import { useDocumentosCliente } from "@/lib/hooks/useDocumentosCliente";

function StatCard({
  href,
  label,
  value,
  icon: Icon,
  cor,
  loading,
}: {
  href: string;
  label: string;
  value: number;
  icon: React.ElementType;
  cor: string;
  loading?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 hover:shadow-md transition-shadow"
    >
      <div
        className="flex size-12 shrink-0 items-center justify-center rounded-xl text-white"
        style={{ backgroundColor: cor }}
      >
        <Icon className="size-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        {loading ? (
          <Loader2 className="mt-1 size-5 animate-spin text-gray-300" />
        ) : (
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        )}
      </div>
      <ArrowRight className="size-4 shrink-0 text-gray-400" />
    </Link>
  );
}

export default function DashboardCliente() {
  const { data: stats, isLoading } = usePortalDashboardStats();
  const { data: empresa } = usePortalEmpresa();
  const { data: ultimosDocs } = useDocumentosCliente("liberado");

  const docsMaisRecentes = ultimosDocs?.slice(0, 5) ?? [];

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {empresa?.nome_empresa ?? "Portal do Cliente"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">Resumo da sua empresa</p>
      </div>

      {/* Cards de stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          href="/portal-cliente/documentos"
          label="Documentos disponíveis"
          value={stats?.docsTotal ?? 0}
          icon={FileText}
          cor="#0D9488"
          loading={isLoading}
        />
        <StatCard
          href="/portal-cliente/pendencias"
          label="Pendências em aberto"
          value={stats?.pendAberta ?? 0}
          icon={ClipboardList}
          cor={stats?.pendAberta ? "#D97706" : "#6B7280"}
          loading={isLoading}
        />
        <StatCard
          href="/portal-cliente/nao-conformidades"
          label="Não conformidades"
          value={stats?.ncsTotal ?? 0}
          icon={AlertTriangle}
          cor={stats?.ncsTotal ? "#DC2626" : "#6B7280"}
          loading={isLoading}
        />
        <StatCard
          href="/portal-cliente/plano-acao"
          label="Ações vencidas"
          value={stats?.acoesVencidas ?? 0}
          icon={ListChecks}
          cor={stats?.acoesVencidas ? "#DC2626" : "#6B7280"}
          loading={isLoading}
        />
        <StatCard
          href="/portal-cliente/plano-acao"
          label="Vencimentos próximos (7d)"
          value={stats?.acoesProximas ?? 0}
          icon={Clock}
          cor={stats?.acoesProximas ? "#D97706" : "#6B7280"}
          loading={isLoading}
        />
        <StatCard
          href="/portal-cliente/documentos"
          label="Documentos assinados"
          value={stats?.docsAssinados ?? 0}
          icon={FileText}
          cor="#059669"
          loading={isLoading}
        />
      </div>

      {/* Últimos documentos liberados */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">Últimos documentos liberados</h2>
          <Link href="/portal-cliente/documentos" className="text-sm text-teal-700 hover:underline">
            Ver todos
          </Link>
        </div>

        {docsMaisRecentes.length === 0 ? (
          <p className="rounded-xl bg-white p-5 text-sm text-gray-400 shadow-sm ring-1 ring-black/5">
            Nenhum documento liberado ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {docsMaisRecentes.map((doc) => (
              <Link
                key={doc.id}
                href="/portal-cliente/documentos"
                className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/5 hover:shadow-md transition-shadow"
              >
                <FileText className="size-4 shrink-0 text-teal-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">{doc.titulo}</p>
                  <p className="text-xs text-gray-500">
                    {doc.tipo_documento} · {doc.data_emissao ?? doc.criado_em.slice(0, 10)}
                  </p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-gray-400" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
