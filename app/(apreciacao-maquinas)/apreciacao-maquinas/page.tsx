"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Cog,
  Plus,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  ClipboardList,
  Search,
} from "lucide-react";
import { useApreciacoesMaquinas } from "@/lib/hooks/useApreciacoesMaquinas";
import { useApreciacaoDashboard } from "@/lib/hooks/useFichasMaquina";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { useCanCreate } from "@/lib/hooks/useUsuario";
import { useUnidadeFiltro } from "@/lib/hooks/useUnidadeFiltro";
import type { StatusApreciacao } from "@/lib/supabase/types";

export default function ApreciacaoMaquinasPage() {
  const canCreate = useCanCreate();
  const { data: apreciacoesAll = [], isLoading } = useApreciacoesMaquinas();
  const { data: dash } = useApreciacaoDashboard();
  const { data: empresas = [] } = useEmpresas();
  const { inUnidade } = useUnidadeFiltro();
  const apreciacoes = useMemo(() => apreciacoesAll.filter((a) => inUnidade(a.id_empresa)), [apreciacoesAll, inUnidade]);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusApreciacao | "TODAS">(
    "TODAS"
  );

  const empresaMap = useMemo(() => {
    const m = new Map<string, string>();
    empresas.forEach((e) => m.set(e.id_empresa, e.nome_empresa));
    return m;
  }, [empresas]);

  const totalFinalizados = apreciacoes.filter(
    (r) => r.status === "FINALIZADO"
  ).length;
  const totalRascunho = apreciacoes.length - totalFinalizados;

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return apreciacoes.filter((a) => {
      if (filtroStatus !== "TODAS" && a.status !== filtroStatus) return false;
      if (!q) return true;
      const empresaNome = empresaMap.get(a.id_empresa) ?? "";
      return [
        a.titulo,
        a.maquina_descricao,
        a.setor,
        a.responsavel,
        empresaNome,
      ]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
  }, [apreciacoes, busca, filtroStatus, empresaMap]);

  const idsFiltrados = useMemo(
    () => new Set(filtradas.map((a) => a.id_apreciacao)),
    [filtradas]
  );
  const totalMaquinas = useMemo(
    () =>
      filtradas.reduce(
        (s, a) => s + (dash?.fichasCount[a.id_apreciacao] ?? 0),
        0
      ),
    [filtradas, dash]
  );
  const resumoRisco = useMemo(() => {
    const r = { ALTO: 0, MEDIO: 0, BAIXO: 0, DESPREZIVEL: 0 };
    (dash?.riscos ?? []).forEach((x) => {
      if (!idsFiltrados.has(x.id_apreciacao)) return;
      if (x.classe && x.classe in r) r[x.classe as keyof typeof r] += 1;
    });
    return r;
  }, [dash, idsFiltrados]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/inicio"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-verde-primary"
        >
          <ArrowLeft className="size-3.5" /> Voltar ao início
        </Link>
        {canCreate && (
          <Link
            href="/apreciacao-maquinas/nova"
            className="inline-flex items-center gap-1.5 rounded-md bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-700"
          >
            <Plus className="size-4" /> Nova apreciação
          </Link>
        )}
      </div>

      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <Cog className="size-5 text-orange-600" />
          Apreciação de Máquinas (NR-12)
        </h1>
        <p className="text-sm text-gray-600">
          Apreciação de risco de máquinas e equipamentos em conformidade com o
          item 12.1.9 da NR-12 e normas ABNT NBR 12100, 14009, 14154 e ABNT
          ISO/TR 14121-2:2018. Avalia checklist regulatório por categoria,
          realiza análise de riscos pelo método HRN (POD × FEP × GPD), gera
          Plano de Adequação com prazos e mantém relação atualizada do parque
          de máquinas.
        </p>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          label="Total de apreciações"
          valor={isLoading ? "…" : apreciacoes.length}
          icon={<ClipboardList className="size-5" />}
          cor="orange"
        />
        <Card
          label="Máquinas avaliadas"
          valor={isLoading ? "…" : totalMaquinas}
          icon={<Cog className="size-5" />}
          cor="sky"
        />
        <Card
          label="Finalizadas"
          valor={isLoading ? "…" : totalFinalizados}
          icon={<ShieldCheck className="size-5" />}
          cor="emerald"
        />
        <Card
          label="Em rascunho"
          valor={isLoading ? "…" : totalRascunho}
          icon={<ShieldAlert className="size-5" />}
          cor="amber"
        />
      </div>

      {/* Risco das máquinas avaliadas (residual quando avaliado, senão inicial) */}
      {apreciacoes.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Risco das máquinas avaliadas (HRN)
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["ALTO", "Alto", "border-red-200 bg-red-50 text-red-700"],
                ["MEDIO", "Médio", "border-amber-200 bg-amber-50 text-amber-700"],
                ["BAIXO", "Baixo", "border-emerald-200 bg-emerald-50 text-emerald-700"],
                ["DESPREZIVEL", "Desprezível", "border-gray-200 bg-gray-50 text-gray-600"],
              ] as [keyof typeof resumoRisco, string, string][]
            ).map(([k, label, cls]) => (
              <div
                key={k}
                className={`flex items-center justify-between rounded-md border px-3 py-2 ${cls}`}
              >
                <span className="text-xs font-semibold">{label}</span>
                <span className="text-lg font-bold tabular-nums">
                  {resumoRisco[k]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por título, máquina, setor, responsável..."
            className="w-full rounded-md border border-gray-300 bg-white px-9 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
        <select
          value={filtroStatus}
          onChange={(e) =>
            setFiltroStatus(e.target.value as StatusApreciacao | "TODAS")
          }
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
        >
          <option value="TODAS">Todos os status</option>
          <option value="RASCUNHO">Em rascunho</option>
          <option value="FINALIZADO">Finalizadas</option>
        </select>
      </div>

      {/* Lista */}
      <section>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : filtradas.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
            {apreciacoes.length === 0 ? (
              <>
                Nenhuma apreciação criada ainda.{" "}
                {canCreate && (
                  <>
                    Clique em <strong>Nova apreciação</strong> para começar.
                  </>
                )}
              </>
            ) : (
              "Nenhum resultado para os filtros atuais."
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm reveal-up card-hover">
            {filtradas.map((a) => (
              <Link
                key={a.id_apreciacao}
                href={`/apreciacao-maquinas/${a.id_apreciacao}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
              >
                <Cog className="size-4 shrink-0 text-orange-600" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {a.titulo ||
                        a.maquina_descricao ||
                        `Apreciação ${a.id_apreciacao.slice(-6)}`}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        a.status === "FINALIZADO"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {a.status === "FINALIZADO" ? "Finalizada" : "Rascunho"}
                    </span>
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                      {dash?.fichasCount[a.id_apreciacao] ?? 0} máq.
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    {empresaMap.get(a.id_empresa) ?? "—"}
                    {a.setor ? ` · Setor: ${a.setor}` : ""}
                    {a.responsavel ? ` · ${a.responsavel}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-gray-500">
                  {new Date(a.created_at).toLocaleDateString("pt-BR")}
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
  cor: "orange" | "emerald" | "amber" | "sky";
}) {
  const cores: Record<string, string> = {
    orange: "border-orange-200 bg-orange-50 text-orange-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
  };
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-white p-4 shadow-sm card-hover">
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
