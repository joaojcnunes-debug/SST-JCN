"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  ClipboardList,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import StatusBadge from "@/components/inspecoes/StatusBadge";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { cn, fmtData } from "@/lib/utils";
import type { Inspecao, Empresa } from "@/lib/supabase/types";

interface DashboardStats {
  empresasAtivas: number;
  totalInspecoes: number;
  emAndamento: number;
  concluidas: number;
  rascunho: number;
}

interface InspecaoComEmpresa extends Inspecao {
  empresa_nome?: string;
}

async function fetchStats(): Promise<DashboardStats> {
  const supabase = createSupabaseBrowserClient();
  const [empAtivas, total, andamento, concluidas, rascunho] = await Promise.all([
    supabase.from("empresas").select("id_empresa", { count: "exact", head: true }).eq("status", "Ativo"),
    supabase.from("inspecoes").select("id_inspecao", { count: "exact", head: true }),
    supabase.from("inspecoes").select("id_inspecao", { count: "exact", head: true }).eq("status", "EM_ANDAMENTO"),
    supabase.from("inspecoes").select("id_inspecao", { count: "exact", head: true }).eq("status", "CONCLUIDA"),
    supabase.from("inspecoes").select("id_inspecao", { count: "exact", head: true }).eq("status", "RASCUNHO"),
  ]);

  return {
    empresasAtivas: empAtivas.count ?? 0,
    totalInspecoes: total.count ?? 0,
    emAndamento: andamento.count ?? 0,
    concluidas: concluidas.count ?? 0,
    rascunho: rascunho.count ?? 0,
  };
}

async function fetchInspecoesRecentes(): Promise<InspecaoComEmpresa[]> {
  const supabase = createSupabaseBrowserClient();
  const { data: insp, error } = await supabase
    .from("inspecoes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);
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

const STATUS_BARS = [
  { key: "emAndamento", label: "Em Andamento", bar: "bg-amber-400", text: "text-amber-700" },
  { key: "concluidas", label: "Concluídas", bar: "bg-green-500", text: "text-green-700" },
  { key: "rascunho", label: "Rascunho", bar: "bg-slate-300", text: "text-slate-600" },
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
      {/* KPIs */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Visão Geral
        </h2>
        {loadingStats ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-200/70" />
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

      {/* Distribuição por status — analítico */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Distribuição por Status
        </h2>
        {loadingStats ? (
          <div className="h-28 animate-pulse rounded-xl bg-gray-200/70" />
        ) : stats && stats.totalInspecoes > 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="space-y-3.5">
              {STATUS_BARS.map(({ key, label, bar, text }) => {
                const count = stats[key];
                const pct = Math.round((count / stats.totalInspecoes) * 100);
                return (
                  <div key={key} className="flex items-center gap-3">
                    <p className="w-32 shrink-0 text-xs font-medium text-gray-600">{label}</p>
                    <div className="flex-1 overflow-hidden rounded-full bg-gray-100" style={{ height: 8 }}>
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", bar)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex w-16 items-center justify-end gap-1.5">
                      <span className={cn("text-xs font-bold", text)}>{count}</span>
                      <span className="text-xs text-gray-400">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-right text-[10px] text-gray-400">
              Base: {stats.totalInspecoes} inspeção{stats.totalInspecoes !== 1 ? "ões" : ""} cadastrada{stats.totalInspecoes !== 1 ? "s" : ""}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white p-5 text-center text-sm text-gray-400">
            Nenhuma inspeção cadastrada para exibir distribuição.
          </div>
        )}
      </section>

      {/* Atividade recente — widget informacional, sem botões operacionais */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Atividade Recente
          </h2>
          <Link
            href="/inspecoes"
            className="text-xs font-medium text-verde-primary hover:underline"
          >
            Acessar módulo →
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
                    <th className="px-4 py-2.5 text-left font-medium">Status</th>
                    <th className="px-4 py-2.5 text-left font-medium">Data</th>
                    <th className="px-4 py-2.5 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentes.map((insp) => (
                    <tr key={insp.id_inspecao} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {insp.empresa_nome}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={insp.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {fmtData(insp.data_inspecao)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/inspecoes/${insp.id_inspecao}`}
                          className="text-xs font-medium text-verde-primary hover:underline"
                        >
                          Ver →
                        </Link>
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
