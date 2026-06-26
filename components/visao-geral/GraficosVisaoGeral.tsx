"use client";

import Link from "next/link";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, Tooltip,
} from "recharts";

export interface FatiaTipo {
  tipo: string;
  valor: number;
}
export interface FatiaStatus {
  label: string;
  valor: number;
  cor: string;
}
export interface PontoMes {
  mes: string;
  valor: number;
}

const COR_TIPO: Record<string, string> = {
  DRPS: "#7c3aed",
  "Análise de Químicos": "#d97706",
  Apreciação: "#0ea5e9",
  AEP: "#0891b2",
  "Não Conformidade": "#dc2626",
  AET: "#16a34a",
  Conformidade: "#0d9488",
};

interface DonutFatia { label: string; valor: number; cor: string }

/** Card de donut reutilizável: anel + legenda com contagem E %. */
function DonutCard({
  titulo,
  sub,
  unidade,
  link,
  fatias,
}: {
  titulo: string;
  sub?: string;
  unidade: string;
  link?: { href: string; label: string };
  fatias: DonutFatia[];
}) {
  const total = fatias.reduce((s, f) => s + f.valor, 0);
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">{titulo}</p>
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </div>
        {link && (
          <Link href={link.href} className="shrink-0 text-xs font-semibold text-verde-primary hover:underline">
            {link.label} →
          </Link>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="relative size-[150px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={fatias} dataKey="valor" nameKey="label" innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none">
                {fatias.map((f) => <Cell key={f.label} fill={f.cor} />)}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                formatter={(v, n) => [`${v} ${unidade}`, String(n)]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold leading-none text-gray-900">{total}</span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{unidade}</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          {fatias.map((f) => (
            <div key={f.label} className="flex items-center gap-2 text-sm">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: f.cor }} />
              <span className="flex-1 truncate text-gray-600">{f.label}</span>
              <span className="font-semibold text-gray-900">{f.valor}</span>
              <span className="w-9 text-right text-xs text-gray-400">{pct(f.valor)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function GraficosVisaoGeral({
  laudosPorTipo,
  inspecoesPorMes,
  inspecoesPorStatus,
}: {
  laudosPorTipo: FatiaTipo[];
  inspecoesPorMes: PontoMes[];
  inspecoesPorStatus: FatiaStatus[];
}) {
  const totalInsp = inspecoesPorMes.reduce((s, p) => s + p.valor, 0);
  const laudoFatias: DonutFatia[] = laudosPorTipo.map((f) => ({
    label: f.tipo,
    valor: f.valor,
    cor: COR_TIPO[f.tipo] ?? "#94a3b8",
  }));

  return (
    <div className="mt-9 grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* Inspeções por mês (barras) */}
      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Inspeções por mês</p>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              <span className="font-semibold text-gray-900">{totalInsp}</span> nos últimos {inspecoesPorMes.length} meses
            </p>
            <Link href="/dashboard" className="text-xs font-semibold text-verde-primary hover:underline">Ver →</Link>
          </div>
          <div className="h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inspecoesPorMes} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "#f3f4f6" }}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                  formatter={(v) => [`${v} inspeções`, ""]}
                  labelFormatter={(l) => `Mês: ${l}`}
                />
                <Bar dataKey="valor" fill="#0284c7" radius={[4, 4, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Inspeções por status (donut) */}
      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Inspeções por status</p>
        <DonutCard
          titulo="Distribuição das inspeções"
          sub="Concluídas · Em andamento"
          unidade="inspeções"
          link={{ href: "/dashboard", label: "Ver" }}
          fatias={inspecoesPorStatus}
        />
      </section>

      {/* Laudos por tipo (donut) — largura total */}
      <section className="lg:col-span-2">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Laudos por tipo</p>
        <DonutCard
          titulo="Composição dos laudos"
          unidade="laudos"
          link={{ href: "/inicio", label: "Ver módulos" }}
          fatias={laudoFatias}
        />
      </section>
    </div>
  );
}
