"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Plus,
  ListChecks,
  ArrowLeft,
  FileCheck2,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { useRelatoriosNaoConformidade } from "@/lib/hooks/useRelatoriosNaoConformidade";
import { useEmpresas } from "@/lib/hooks/useEmpresas";

export default function VisaoGeralNaoConformidadePage() {
  const { data: relatorios = [], isLoading } = useRelatoriosNaoConformidade();
  const { data: empresas = [] } = useEmpresas();

  const empresaMap = useMemo(() => {
    const m = new Map<string, string>();
    empresas.forEach((e) => m.set(e.id_empresa, e.nome_empresa));
    return m;
  }, [empresas]);

  const totalFinalizados = relatorios.filter(
    (r) => r.status === "FINALIZADO"
  ).length;
  const totalRascunho = relatorios.length - totalFinalizados;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/inicio"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-verde-primary"
        >
          <ArrowLeft className="size-3.5" /> Voltar ao início
        </Link>
        <Link
          href="/relatorio-nao-conformidade/novo"
          className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
        >
          <Plus className="size-4" /> Novo relatório
        </Link>
      </div>

      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <AlertTriangle className="size-5 text-red-600" />
          Relatórios de Não Conformidade
        </h1>
        <p className="text-sm text-gray-600">
          Registre não conformidades observadas em campo: evidência fotográfica,
          criticidade, causa raiz, ação corretiva, prazo e responsável. Cada
          relatório agrupa todas as NCs de uma auditoria.
        </p>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card
          label="Total de relatórios"
          valor={isLoading ? "…" : relatorios.length}
          icon={<FileCheck2 className="size-5" />}
          cor="red"
        />
        <Card
          label="Finalizados"
          valor={isLoading ? "…" : totalFinalizados}
          icon={<ShieldAlert className="size-5" />}
          cor="emerald"
        />
        <Card
          label="Em rascunho"
          valor={isLoading ? "…" : totalRascunho}
          icon={<ListChecks className="size-5" />}
          cor="amber"
        />
      </div>

      {/* Últimos relatórios */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
            Últimos relatórios
          </h2>
          <Link
            href="/relatorio-nao-conformidade/historico"
            className="text-xs font-semibold text-red-700 hover:underline"
          >
            Ver tudo →
          </Link>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : relatorios.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
            Nenhum relatório criado ainda. Clique em{" "}
            <strong>Novo relatório</strong> para começar.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
            {relatorios.slice(0, 8).map((r) => (
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
                    {r.setor ? ` · Setor: ${r.setor}` : ""}
                    {r.responsavel ? ` · ${r.responsavel}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-gray-500">
                  {new Date(r.created_at).toLocaleDateString("pt-BR")}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Card({
  label,
  valor,
  icon,
  cor,
}: {
  label: string;
  valor: string | number;
  icon: React.ReactNode;
  cor: "red" | "emerald" | "amber";
}) {
  const cores: Record<string, string> = {
    red: "border-red-200 bg-red-50 text-red-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
  };
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-white p-4 shadow-sm">
      <div
        className={`flex size-10 items-center justify-center rounded-md ${cores[cor]}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          {label}
        </p>
        <p className="text-2xl font-bold text-gray-900">{valor}</p>
      </div>
    </div>
  );
}
