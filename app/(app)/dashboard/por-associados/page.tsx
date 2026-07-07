"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Users, TrendingUp, X } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LabelList,
} from "recharts";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { corAvatar } from "@/lib/hooks/useGestao";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";

interface AssocRow {
  created_at: string | null;
  nome: string | null;
  id_inspecao: string;
}

async function fetchAssociados(): Promise<AssocRow[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("inspecao_associados")
    .select("created_at, nome, id_inspecao");
  if (error) throw error;
  return (data ?? []) as unknown as AssocRow[];
}

function chaveMes(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}`;
}
function mesLabel(d: Date) {
  return d
    .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
    .replace(".", "")
    .replace(/^\w/, (c) => c.toUpperCase());
}

export default function PorAssociadosDashboard() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["dashboard-por-associados"],
    queryFn: fetchAssociados,
  });

  const [mesSel, setMesSel] = useState<string | null>(null);
  const now = new Date();

  // Só linhas com data (associações do fluxo novo).
  const validas = rows.filter((r) => r.created_at && r.id_inspecao);

  // Por mês — últimos 12 meses, contando INSPEÇÕES DISTINTAS associadas no mês.
  const porMesSets = new Map<string, Set<string>>();
  validas.forEach((r) => {
    const k = chaveMes(new Date(r.created_at!));
    (porMesSets.get(k) ?? porMesSets.set(k, new Set()).get(k)!).add(r.id_inspecao);
  });
  const porMes = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const k = chaveMes(d);
    return { chave: k, mes: mesLabel(d), total: porMesSets.get(k)?.size ?? 0 };
  });

  const mesSelLabel = mesSel ? porMes.find((m) => m.chave === mesSel)?.mes ?? null : null;

  // Por associado — filtrado pelo mês (ou todos). Inspeções distintas por pessoa.
  const rowsFiltradas = mesSel
    ? validas.filter((r) => chaveMes(new Date(r.created_at!)) === mesSel)
    : validas;
  const mapa = new Map<string, Set<string>>();
  rowsFiltradas.forEach((r) => {
    const n = (r.nome ?? "").trim() || "Sem nome";
    (mapa.get(n) ?? mapa.set(n, new Set()).get(n)!).add(r.id_inspecao);
  });
  const porAssociado = Array.from(mapa.entries())
    .map(([nome, set]) => ({ nome, total: set.size }))
    .sort((a, b) => b.total - a.total);

  const totalInspecoes = new Set(validas.map((r) => r.id_inspecao)).size;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-verde-primary">
          <ArrowLeft className="size-4" /> Voltar ao dashboard
        </Link>
        <h1 className="mt-1 flex items-center gap-2 text-xl font-bold text-gray-900">
          <Users className="size-5 text-verde-primary" />
          Inspeções Associadas (por associado)
        </h1>
        <p className="text-sm text-gray-500">
          {isLoading
            ? "Carregando…"
            : `${totalInspecoes} inspeção${totalInspecoes !== 1 ? "ões" : ""} com associação (fluxo novo, com data)`}
        </p>
      </div>

      {/* Por mês */}
      <div className="reveal-up card-hover rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-verde-primary" />
            <h2 className="text-sm font-semibold text-gray-800">Por mês (últimos 12 meses)</h2>
          </div>
          <p className="text-xs text-gray-400">Clique num mês para filtrar abaixo</p>
        </div>
        {isLoading ? (
          <div className="h-56 animate-pulse rounded-xl bg-gray-100" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={porMes} barSize={26} margin={{ top: 16, right: 4, left: -16, bottom: 0 }}>
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
              <Tooltip
                cursor={{ fill: "#f0fdf4" }}
                contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12, padding: "6px 12px" }}
                formatter={(v) => [`${v} inspeç${Number(v) !== 1 ? "ões" : "ão"}`, ""]}
              />
              <Bar
                dataKey="total"
                radius={[6, 6, 0, 0]}
                cursor="pointer"
                onClick={(d: { chave?: string; payload?: { chave?: string } }) => {
                  const k = d?.chave ?? d?.payload?.chave ?? null;
                  if (!k) return;
                  setMesSel((atual) => (atual === k ? null : k));
                }}
              >
                {porMes.map((m) => (
                  <Cell key={m.chave} fill={mesSel === m.chave ? "#0ea5e9" : "#0ea5e960"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Por associado */}
      <div className="reveal-up card-hover rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-verde-primary" />
            <h2 className="text-sm font-semibold text-gray-800">
              Por associado {mesSelLabel ? `— ${mesSelLabel}` : "— todos os meses"}
            </h2>
          </div>
          {mesSel && (
            <button
              type="button"
              onClick={() => setMesSel(null)}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <X className="size-3" /> Limpar filtro do mês
            </button>
          )}
        </div>
        {isLoading ? (
          <LoadingSkeleton rows={4} />
        ) : porAssociado.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            Nenhuma associação{mesSelLabel ? ` em ${mesSelLabel}` : ""}.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, porAssociado.length * 38)}>
            <BarChart data={porAssociado} layout="vertical" barSize={22} margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="nome" tick={{ fontSize: 11, fill: "#374151" }} axisLine={false} tickLine={false} width={150} />
              <Tooltip
                cursor={{ fill: "#f0fdf4" }}
                contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12, padding: "6px 12px" }}
                formatter={(v) => [`${v} inspeç${Number(v) !== 1 ? "ões" : "ão"}`, ""]}
              />
              <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                {porAssociado.map((p) => (
                  <Cell key={p.nome} fill={p.nome === "Sem nome" ? "#9ca3af" : corAvatar(p.nome)} />
                ))}
                <LabelList dataKey="total" position="right" style={{ fontSize: 12, fontWeight: 700, fill: "#111827" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
