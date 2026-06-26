"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileSignature, TrendingUp, Users, X } from "lucide-react";
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
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";

interface DocRow {
  elaboracao_concluida_em: string | null;
  elaboracao_responsavel: string | null;
}

async function fetchDocumentos(): Promise<DocRow[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("inspecoes")
    .select("elaboracao_concluida_em, elaboracao_responsavel")
    .eq("elaboracao_status", "CONCLUIDO");
  if (error) throw error;
  return (data ?? []) as unknown as DocRow[];
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

export default function DocumentosEmitidosDashboard() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["dashboard-documentos-adm"],
    queryFn: fetchDocumentos,
  });

  const [mesSel, setMesSel] = useState<string | null>(null);
  const now = new Date();

  // Só conta linhas com data de conclusão.
  const validas = rows.filter((r) => r.elaboracao_concluida_em);

  // Por mês — últimos 12 meses (pela data de conclusão do ADM).
  const porMes = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    return { chave: chaveMes(d), mes: mesLabel(d), total: 0 };
  });
  validas.forEach(({ elaboracao_concluida_em }) => {
    const k = chaveMes(new Date(elaboracao_concluida_em!));
    const item = porMes.find((m) => m.chave === k);
    if (item) item.total++;
  });

  const mesSelLabel = mesSel ? porMes.find((m) => m.chave === mesSel)?.mes ?? null : null;

  // Por ADM — filtrado pelo mês selecionado (ou todos).
  const rowsAdm = mesSel
    ? validas.filter((r) => chaveMes(new Date(r.elaboracao_concluida_em!)) === mesSel)
    : validas;
  const mapaAdm = new Map<string, number>();
  rowsAdm.forEach(({ elaboracao_responsavel }) => {
    const a = (elaboracao_responsavel ?? "").trim() || "Sem responsável";
    mapaAdm.set(a, (mapaAdm.get(a) ?? 0) + 1);
  });
  const porAdm = Array.from(mapaAdm.entries())
    .map(([adm, total]) => ({ adm, total }))
    .sort((a, b) => b.total - a.total);

  const total = validas.length;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-verde-primary">
          <ArrowLeft className="size-4" /> Voltar ao dashboard
        </Link>
        <h1 className="mt-1 flex items-center gap-2 text-xl font-bold text-gray-900">
          <FileSignature className="size-5 text-verde-primary" />
          Documentos Concluídos (ADM)
        </h1>
        <p className="text-sm text-gray-500">
          {isLoading ? "Carregando…" : `${total} documento${total !== 1 ? "s" : ""} concluído${total !== 1 ? "s" : ""} (elaborados no SGG e enviados)`}
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
                formatter={(v) => [`${v} documento${Number(v) !== 1 ? "s" : ""}`, ""]}
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

      {/* Por ADM */}
      <div className="reveal-up card-hover rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-verde-primary" />
            <h2 className="text-sm font-semibold text-gray-800">
              Por ADM {mesSelLabel ? `— ${mesSelLabel}` : "— todos os meses"}
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
        ) : porAdm.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            Nenhum documento concluído{mesSelLabel ? ` em ${mesSelLabel}` : ""}.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, porAdm.length * 38)}>
            <BarChart data={porAdm} layout="vertical" barSize={22} margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="adm" tick={{ fontSize: 11, fill: "#374151" }} axisLine={false} tickLine={false} width={150} />
              <Tooltip
                cursor={{ fill: "#f0fdf4" }}
                contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12, padding: "6px 12px" }}
                formatter={(v) => [`${v} documento${Number(v) !== 1 ? "s" : ""}`, ""]}
              />
              <Bar dataKey="total" radius={[0, 6, 6, 0]} fill="#0ea5e9">
                <LabelList dataKey="total" position="right" style={{ fontSize: 12, fontWeight: 700, fill: "#111827" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
