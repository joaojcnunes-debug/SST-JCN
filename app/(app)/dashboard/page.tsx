"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  ClipboardList,
  Clock,
  CheckCircle2,
  FileText,
  ArrowRight,
  RefreshCw,
  TrendingUp,
  Target,
  AlertTriangle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import StatusBadge from "@/components/inspecoes/StatusBadge";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { cn, fmtData } from "@/lib/utils";
import { useUserStore } from "@/lib/store";
import type { Inspecao, Empresa } from "@/lib/supabase/types";
import { useState, useEffect, useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface MesData {
  mes: string;
  total: number;
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

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

async function fetchInspecoesPorMes(): Promise<MesData[]> {
  const supabase = createSupabaseBrowserClient();
  const now = new Date();
  const sixAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const { data } = await supabase
    .from("inspecoes")
    .select("created_at")
    .gte("created_at", sixAgo.toISOString());

  // Skeleton dos últimos 6 meses
  const months: MesData[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      mes: d.toLocaleDateString("pt-BR", { month: "short" })
        .replace(".", "")
        .replace(/^\w/, (c) => c.toUpperCase()),
      total: 0,
    };
  });

  (data ?? []).forEach(({ created_at }) => {
    const d = new Date(created_at);
    const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    const idx = 5 - diff;
    if (idx >= 0 && idx < 6) months[idx].total++;
  });

  return months;
}

async function fetchInspecoesRecentes(): Promise<InspecaoComEmpresa[]> {
  const supabase = createSupabaseBrowserClient();
  const { data: insp, error } = await supabase
    .from("inspecoes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(8);
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

  return inspecoes.map((i) => ({ ...i, empresa_nome: empMap.get(i.id_empresa) ?? "—" }));
}

// ─── Constantes visuais ───────────────────────────────────────────────────────

const PIE_COLORS = ["#d97706", "#006B54", "#94a3b8"];

const KPI_CONFIG = [
  { key: "empresasAtivas" as const, label: "Empresas Ativas",  icon: Building2,    color: "#006B54", from: "#ecfdf5" },
  { key: "totalInspecoes" as const, label: "Total Inspeções",  icon: ClipboardList, color: "#0369a1", from: "#eff6ff" },
  { key: "emAndamento"    as const, label: "Em Andamento",     icon: Clock,         color: "#d97706", from: "#fffbeb" },
  { key: "concluidas"     as const, label: "Concluídas",       icon: CheckCircle2,  color: "#16a34a", from: "#f0fdf4" },
  { key: "rascunho"       as const, label: "Rascunhos",        icon: FileText,      color: "#64748b", from: "#f8fafc" },
] as const;

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const user = useUserStore((s) => s.user);
  const [greeting, setGreeting] = useState("");
  const [lastUpdate, setLastUpdate] = useState("");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = now.getHours();
      const nome = user?.nome?.split(" ")[0] ?? "";
      const saudacao = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
      setGreeting(`${saudacao}${nome ? `, ${nome}` : ""}`);
      setLastUpdate(now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    };
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [user?.nome]);

  const { data: stats, isLoading: loadingStats, refetch } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchStats,
  });

  const { data: porMes, isLoading: loadingMes } = useQuery({
    queryKey: ["dashboard-por-mes"],
    queryFn: fetchInspecoesPorMes,
  });

  const { data: recentes, isLoading: loadingRecentes } = useQuery({
    queryKey: ["dashboard-recentes"],
    queryFn: fetchInspecoesRecentes,
  });

  const pieData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: "Em Andamento", value: stats.emAndamento },
      { name: "Concluídas",   value: stats.concluidas },
      { name: "Rascunho",     value: stats.rascunho },
    ].filter((d) => d.value > 0);
  }, [stats]);

  return (
    <div className="space-y-5">

      {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{greeting || "Dashboard"}</h1>
          <p className="mt-0.5 text-xs text-gray-400">
            Última atualização às {lastUpdate || "—"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm transition hover:bg-gray-50 active:scale-95"
        >
          <RefreshCw className="size-3.5" />
          Atualizar
        </button>
      </div>

      {/* ── KPIs ──────────────────────────────────────────────────────── */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {loadingStats
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-200/70" />
            ))
          : KPI_CONFIG.map(({ key, label, icon: Icon, color, from }) => (
              <KpiCard
                key={key}
                label={label}
                value={stats?.[key] ?? 0}
                icon={Icon}
                color={color}
                from={from}
                warn={key === "emAndamento" && (stats?.emAndamento ?? 0) > 0}
              />
            ))}
      </section>

      {/* ── Gráficos ──────────────────────────────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-3">

        {/* BarChart — inspeções por mês */}
        <div className="lg:col-span-2 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Inspeções por Mês</h2>
              <p className="mt-0.5 text-xs text-gray-400">Últimos 6 meses</p>
            </div>
            <div className="flex size-8 items-center justify-center rounded-lg bg-verde-light">
              <TrendingUp className="size-4 text-verde-primary" />
            </div>
          </div>
          {loadingMes ? (
            <div className="h-52 animate-pulse rounded-xl bg-gray-100" />
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={porMes} barSize={32} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <XAxis
                  dataKey="mes"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={28}
                />
                <Tooltip
                  cursor={{ fill: "#f0fdf4" }}
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    fontSize: 12,
                    padding: "6px 12px",
                  }}
                  formatter={(v) => [
                    `${v} inspeção${Number(v) !== 1 ? "ões" : ""}`,
                    "",
                  ]}
                  labelStyle={{ fontWeight: 600, color: "#111827", marginBottom: 2 }}
                />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                  {(porMes ?? []).map((_, idx, arr) => (
                    <Cell
                      key={idx}
                      fill={idx === arr.length - 1 ? "#006B54" : "#006B5460"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* PieChart — distribuição por status */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Por Status</h2>
              <p className="mt-0.5 text-xs text-gray-400">Distribuição total</p>
            </div>
            <div className="flex size-8 items-center justify-center rounded-lg bg-verde-light">
              <Target className="size-4 text-verde-primary" />
            </div>
          </div>

          {loadingStats ? (
            <div className="h-52 animate-pulse rounded-xl bg-gray-100" />
          ) : pieData.length === 0 ? (
            <div className="flex h-52 items-center justify-center text-sm text-gray-400">
              Nenhum dado disponível
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {pieData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid #e5e7eb",
                      fontSize: 12,
                      padding: "6px 12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Legenda manual */}
              <div className="mt-1 w-full space-y-2">
                {pieData.map((item, idx) => {
                  const total = pieData.reduce((s, d) => s + d.value, 0);
                  const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                  return (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                        />
                        <span className="text-gray-600">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-gray-800">{item.value}</span>
                        <span className="text-gray-400">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Atividade recente ─────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Atividade Recente</h2>
          <Link
            href="/inspecoes"
            className="flex items-center gap-1 text-xs font-medium text-verde-primary transition hover:underline"
          >
            Ver todas <ArrowRight className="size-3" />
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          {loadingRecentes ? (
            <div className="p-4">
              <LoadingSkeleton rows={6} />
            </div>
          ) : !recentes || recentes.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">
              Nenhuma inspeção registrada ainda.{" "}
              <Link href="/inspecoes/nova" className="font-medium text-verde-primary hover:underline">
                Crie a primeira →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70">
                    {["Empresa", "Status", "Data", ""].map((h) => (
                      <th
                        key={h}
                        className={cn(
                          "px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400",
                          h === "" ? "text-right" : "text-left"
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentes.map((insp, idx) => (
                    <tr
                      key={insp.id_inspecao}
                      className={cn(
                        "transition-colors hover:bg-verde-light/30",
                        idx < recentes.length - 1 && "border-b border-gray-50"
                      )}
                    >
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
                          className="inline-flex items-center gap-1 rounded-lg bg-verde-light px-2.5 py-1 text-xs font-medium text-verde-primary transition hover:bg-verde-border"
                        >
                          Abrir <ArrowRight className="size-3" />
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

// ─── KpiCard ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  from,
  warn = false,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  from: string;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md",
        warn ? "border-amber-200 bg-amber-50/60" : "border-gray-100 bg-white"
      )}
      style={!warn ? { background: `linear-gradient(135deg, ${from} 0%, #ffffff 100%)` } : undefined}
    >
      {/* Círculo decorativo de fundo */}
      <div
        className="pointer-events-none absolute -right-4 -top-4 size-20 rounded-full opacity-[0.07]"
        style={{ backgroundColor: color }}
      />

      <div className="flex items-start justify-between">
        <p className="text-xs font-medium leading-tight text-gray-500">{label}</p>
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: color + "18", color }}
        >
          <Icon className="size-4" />
        </div>
      </div>

      <p className="mt-2 text-3xl font-bold tracking-tight" style={{ color }}>
        {value.toLocaleString("pt-BR")}
      </p>

      {warn && value > 0 && (
        <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-amber-600">
          <AlertTriangle className="size-3" />
          Requer atenção
        </p>
      )}
    </div>
  );
}
