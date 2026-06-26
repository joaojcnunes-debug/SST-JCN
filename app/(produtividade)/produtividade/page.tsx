"use client";

import { useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { AlertTriangle, BarChart2, ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import {
  useProdUnidades,
  useProdSnapshots,
  useProdColaboradores,
} from "@/lib/hooks/useProdutividade";

const MESES_LABEL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function KpiCard({
  label,
  value,
  sub,
  colorClass,
}: {
  label: string;
  value: number | string;
  sub?: string;
  colorClass: string;
}) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${colorClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export default function ProdutividadeDashboard() {
  const today = new Date();
  const [mes, setMes] = useState(today.getMonth() + 1);
  const [ano, setAno] = useState(today.getFullYear());
  const [unidadeFilter, setUnidadeFilter] = useState("");

  const { data: unidades = [], isLoading: loadingU } = useProdUnidades();
  const { data: snapshots = [], isLoading: loadingS } = useProdSnapshots(mes, ano);
  const { data: colaboradores = [] } = useProdColaboradores();

  const isLoading = loadingU || loadingS;

  function prevMes() { if (mes === 1) { setMes(12); setAno((a) => a - 1); } else setMes((m) => m - 1); }
  function nextMes() { if (mes === 12) { setMes(1); setAno((a) => a + 1); } else setMes((m) => m + 1); }

  // Snapshot por unidade (filtrado por unidade selecionada, se houver).
  const linhas = useMemo(() => {
    const porUnidade = new Map(snapshots.map((s) => [s.id_unidade, s]));
    return unidades
      .filter((u) => !unidadeFilter || u.id === unidadeFilter)
      .map((u) => {
        const s = porUnidade.get(u.id);
        return {
          unidade: u,
          pagantes: s?.clientes_pagantes ?? 0,
          cortesia: s?.clientes_cortesia ?? 0,
          vencidos: s?.vencidos ?? 0,
          vencendo: s?.vencendo ?? 0,
          inspecao: s?.inspecao_pendente ?? 0,
          colaboradores: colaboradores.filter((c) => c.id_unidade === u.id && c.ativo).length,
        };
      });
  }, [snapshots, unidades, unidadeFilter, colaboradores]);

  const tot = linhas.reduce(
    (a, l) => {
      a.pagantes += l.pagantes; a.cortesia += l.cortesia;
      a.vencidos += l.vencidos; a.vencendo += l.vencendo; a.inspecao += l.inspecao;
      return a;
    },
    { pagantes: 0, cortesia: 0, vencidos: 0, vencendo: 0, inspecao: 0 },
  );
  const totalClientes = tot.pagantes + tot.cortesia;
  const temDados = linhas.some((l) => l.pagantes || l.cortesia || l.vencidos || l.vencendo || l.inspecao);

  // Gráfico de barras por unidade (pendências).
  const barData = linhas
    .map((l) => ({
      name: l.unidade.nome.length > 10 ? l.unidade.nome.slice(0, 10) + "…" : l.unidade.nome,
      Vencidos: l.vencidos,
      Vencendo: l.vencendo,
      "Insp. pendente": l.inspecao,
    }))
    .filter((u) => u.Vencidos > 0 || u.Vencendo > 0 || u["Insp. pendente"] > 0);

  // Pizza: composição das pendências.
  const pieData = [
    { name: "Vencidos", value: tot.vencidos, color: "#ef4444" },
    { name: "Vencendo", value: tot.vencendo, color: "#eab308" },
    { name: "Insp. pendente", value: tot.inspecao, color: "#f97316" },
  ].filter((p) => p.value > 0);

  // Ranking por pendências (vencidos + vencendo + inspeção).
  const ranking = [...linhas]
    .map((l) => ({ ...l, pend: l.vencidos + l.vencendo + l.inspecao }))
    .sort((a, b) => b.pend - a.pend);

  function exportExcel() {
    const rows = linhas.map((l) => ({
      Unidade: l.unidade.nome,
      Responsável: l.unidade.responsavel ?? "",
      Pagantes: l.pagantes,
      Cortesia: l.cortesia,
      Vencidos: l.vencidos,
      Vencendo: l.vencendo,
      "Inspeção pendente": l.inspecao,
      Colaboradores: l.colaboradores,
    }));
    rows.push({
      Unidade: "TOTAL", Responsável: "", Pagantes: tot.pagantes, Cortesia: tot.cortesia,
      Vencidos: tot.vencidos, Vencendo: tot.vencendo, "Inspeção pendente": tot.inspecao,
      Colaboradores: linhas.reduce((s, l) => s + l.colaboradores, 0),
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${MESES_LABEL[mes - 1]} ${ano}`);
    XLSX.writeFile(wb, `produtividade-${ano}-${String(mes).padStart(2, "0")}.xlsx`);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard de Produtividade</h1>
          <p className="mt-0.5 text-sm text-gray-500">Quantitativo de clientes e pendências por unidade</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 shadow-sm ring-1 ring-black/5">
            <button type="button" onClick={prevMes} className="rounded p-1 hover:bg-gray-100">
              <ChevronLeft className="size-4 text-gray-500" />
            </button>
            <p className="min-w-[130px] text-center text-sm font-bold text-gray-800">
              {MESES_LABEL[mes - 1]} de {ano}
            </p>
            <button type="button" onClick={nextMes} className="rounded p-1 hover:bg-gray-100">
              <ChevronRight className="size-4 text-gray-500" />
            </button>
          </div>
          <select
            value={unidadeFilter}
            onChange={(e) => setUnidadeFilter(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">Todas as unidades</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>{u.nome}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={exportExcel}
            className="flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            <Download className="size-4" /> Excel
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="size-4 animate-spin" /> Carregando dados…
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Clientes" value={totalClientes} sub={`${tot.pagantes} pagantes · ${tot.cortesia} cortesia`} colorClass="text-gray-900" />
        <KpiCard label="Pagantes" value={tot.pagantes} sub="clientes pagantes" colorClass="text-gray-900" />
        <KpiCard label="Cortesia" value={tot.cortesia} sub="clientes cortesia" colorClass="text-gray-500" />
        <KpiCard label="Vencidos" value={tot.vencidos} sub="requer ação imediata" colorClass="text-red-600" />
        <KpiCard label="Vencendo" value={tot.vencendo} sub="atenção nos próximos dias" colorClass="text-yellow-600" />
        <KpiCard label="Insp. Pendente" value={tot.inspecao} sub="inspeções a realizar" colorClass="text-orange-600" />
      </div>

      {/* Alerta de vencidos */}
      {tot.vencidos > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-red-600" />
            <span className="font-semibold text-red-800">{tot.vencidos} documento(s) vencido(s)</span>
            <span className="text-sm text-red-600">— requer renovação imediata</span>
          </div>
        </div>
      )}

      {/* Charts */}
      {!isLoading && temDados && (
        <div className="grid gap-6 lg:grid-cols-2">
          {pieData.length > 0 && (
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <h2 className="mb-3 text-sm font-semibold text-gray-700">Composição das Pendências</h2>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="45%" outerRadius={85} dataKey="value"
                    label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                    {pieData.map((e) => <Cell key={e.name} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v}`, ""]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {barData.length > 0 && (
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <h2 className="mb-3 text-sm font-semibold text-gray-700">Pendências por Unidade</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Vencidos" stackId="a" fill="#ef4444" />
                  <Bar dataKey="Vencendo" stackId="a" fill="#eab308" />
                  <Bar dataKey="Insp. pendente" stackId="a" fill="#f97316" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Ranking */}
      {temDados && (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="border-b border-gray-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-700">Ranking de Unidades — Pendências</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-[11px] uppercase text-gray-400">
                  <th className="px-5 py-3 text-left">#</th>
                  <th className="px-5 py-3 text-left">Unidade</th>
                  <th className="px-5 py-3 text-left">Responsável</th>
                  <th className="px-5 py-3 text-right">Pagantes</th>
                  <th className="px-5 py-3 text-right">Vencidos</th>
                  <th className="px-5 py-3 text-right">Vencendo</th>
                  <th className="px-5 py-3 text-right">Insp. pend.</th>
                  <th className="px-5 py-3 text-right">Equipe</th>
                  <th className="px-5 py-3 text-right">Pendências</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {ranking.map((l, idx) => (
                  <tr key={l.unidade.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-mono text-xs text-gray-400">#{idx + 1}</td>
                    <td className="px-5 py-3 font-medium text-gray-800">{l.unidade.nome}</td>
                    <td className="px-5 py-3 text-xs text-gray-500">{l.unidade.responsavel ?? "—"}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{l.pagantes}</td>
                    <td className="px-5 py-3 text-right text-red-600">{l.vencidos}</td>
                    <td className="px-5 py-3 text-right text-yellow-600">{l.vencendo}</td>
                    <td className="px-5 py-3 text-right text-orange-600">{l.inspecao}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{l.colaboradores}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        l.pend > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                      }`}>{l.pend}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !temDados && (
        <div className="rounded-xl bg-white p-16 text-center shadow-sm ring-1 ring-black/5">
          <BarChart2 className="mx-auto size-14 text-gray-200" />
          <h3 className="mt-4 text-lg font-semibold text-gray-600">
            Sem dados para {MESES_LABEL[mes - 1]} de {ano}
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-gray-400">
            Lance o quantitativo do mês em <strong>Controle Mensal</strong> (manual ou importando da
            planilha) para o dashboard refletir clientes e pendências por unidade.
          </p>
        </div>
      )}
    </div>
  );
}
