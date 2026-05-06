"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  ClipboardList,
  Clock,
  CheckCircle2,
  PlusCircle,
  History,
  ChartBar,
  Eye,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import StatusBadge from "@/components/inspecoes/StatusBadge";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { fmtData } from "@/lib/utils";
import type { Inspecao, Empresa } from "@/lib/supabase/types";

interface DashboardStats {
  empresasAtivas: number;
  totalInspecoes: number;
  emAndamento: number;
  concluidas: number;
}

interface InspecaoComEmpresa extends Inspecao {
  empresa_nome?: string;
}

async function fetchStats(): Promise<DashboardStats> {
  const supabase = createSupabaseBrowserClient();
  const [empAtivas, total, andamento, concluidas] = await Promise.all([
    supabase
      .from("empresas")
      .select("id_empresa", { count: "exact", head: true })
      .eq("status", "Ativo"),
    supabase.from("inspecoes").select("id_inspecao", { count: "exact", head: true }),
    supabase
      .from("inspecoes")
      .select("id_inspecao", { count: "exact", head: true })
      .eq("status", "EM_ANDAMENTO"),
    supabase
      .from("inspecoes")
      .select("id_inspecao", { count: "exact", head: true })
      .eq("status", "CONCLUIDA"),
  ]);

  return {
    empresasAtivas: empAtivas.count ?? 0,
    totalInspecoes: total.count ?? 0,
    emAndamento: andamento.count ?? 0,
    concluidas: concluidas.count ?? 0,
  };
}

async function fetchInspecoesRecentes(): Promise<InspecaoComEmpresa[]> {
  const supabase = createSupabaseBrowserClient();
  const { data: insp, error } = await supabase
    .from("inspecoes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;

  const inspecoes = (insp ?? []) as unknown as Inspecao[];
  const ids = Array.from(new Set(inspecoes.map((i) => i.id_empresa)));
  if (ids.length === 0) return [];

  const { data: emps } = await supabase
    .from("empresas")
    .select("id_empresa, nome_empresa")
    .in("id_empresa", ids);

  const empMap = new Map(
    ((emps ?? []) as unknown as Pick<Empresa, "id_empresa" | "nome_empresa">[])
      .map((e) => [e.id_empresa, e.nome_empresa])
  );

  return inspecoes.map((i) => ({
    ...i,
    empresa_nome: empMap.get(i.id_empresa) ?? "—",
  }));
}

const STAT_CARDS = [
  { key: "empresasAtivas", label: "Empresas Ativas", icon: Building2, color: "#006B54" },
  { key: "totalInspecoes", label: "Total de Inspeções", icon: ClipboardList, color: "#0369a1" },
  { key: "emAndamento", label: "Em Andamento", icon: Clock, color: "#d97706" },
  { key: "concluidas", label: "Concluídas", icon: CheckCircle2, color: "#16a34a" },
] as const;

export default function DashboardPage() {
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchStats,
  });

  const { data: recentes, isLoading: loadingRecentes } = useQuery({
    queryKey: ["dashboard-recentes"],
    queryFn: fetchInspecoesRecentes,
  });

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Visão Geral
        </h2>
        {loadingStats ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl bg-gray-200/70"
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STAT_CARDS.map(({ key, label, icon: Icon, color }) => (
              <div
                key={key}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                    {label}
                  </p>
                  <div
                    className="flex size-8 items-center justify-center rounded-lg"
                    style={{ backgroundColor: color + "15", color }}
                  >
                    <Icon className="size-4" />
                  </div>
                </div>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {stats?.[key] ?? 0}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Ações rápidas */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Ações Rápidas
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          <Link
            href="/empresas"
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex size-10 items-center justify-center rounded-lg bg-verde-light text-verde-primary">
              <Building2 className="size-5" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Gerenciar Empresas</p>
              <p className="text-xs text-gray-500">Cadastros e dados</p>
            </div>
          </Link>
          <Link
            href="/inspecoes"
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <History className="size-5" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Histórico</p>
              <p className="text-xs text-gray-500">Todas as inspeções</p>
            </div>
          </Link>
          <Link
            href="/inspecoes/nova"
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-verde-primary p-4 text-white shadow-sm transition-shadow hover:bg-verde-accent hover:shadow-md"
          >
            <div className="flex size-10 items-center justify-center rounded-lg bg-white/15">
              <PlusCircle className="size-5" />
            </div>
            <div>
              <p className="font-medium">Nova Inspeção</p>
              <p className="text-xs text-white/80">Iniciar uma agora</p>
            </div>
          </Link>
        </div>
      </section>

      {/* Inspeções recentes */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Inspeções Recentes
          </h2>
          <Link
            href="/inspecoes"
            className="text-xs font-medium text-verde-primary hover:underline"
          >
            Ver todas →
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {loadingRecentes ? (
            <div className="p-4">
              <LoadingSkeleton rows={5} />
            </div>
          ) : !recentes || recentes.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              Nenhuma inspeção registrada ainda.{" "}
              <Link
                href="/inspecoes/nova"
                className="font-medium text-verde-primary hover:underline"
              >
                Crie a primeira →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Empresa</th>
                    <th className="px-4 py-2.5 text-left font-medium">ID</th>
                    <th className="px-4 py-2.5 text-center font-medium">Rev.</th>
                    <th className="px-4 py-2.5 text-left font-medium">Status</th>
                    <th className="px-4 py-2.5 text-left font-medium">Data</th>
                    <th className="px-4 py-2.5 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentes.map((insp) => (
                    <tr key={insp.id_inspecao} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">
                        {insp.empresa_nome}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500">
                        {insp.id_inspecao}
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-700">
                        {insp.revisao}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={insp.status} />
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">
                        {fmtData(insp.data_inspecao)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1">
                          <Link
                            href={`/inspecoes/${insp.id_inspecao}`}
                            className="rounded p-1.5 text-gray-500 hover:bg-verde-light hover:text-verde-primary"
                            title="Ver/Editar"
                          >
                            <Eye className="size-4" />
                          </Link>
                          <Link
                            href={`/inspecoes/${insp.id_inspecao}/relatorio`}
                            className="rounded p-1.5 text-gray-500 hover:bg-blue-50 hover:text-blue-700"
                            title="Relatório"
                          >
                            <ChartBar className="size-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
