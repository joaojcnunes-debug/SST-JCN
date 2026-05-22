"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  LayoutDashboard,
  Plus,
  Users,
} from "lucide-react";
import { useAetRelatorios } from "@/lib/hooks/useAet";
import { useCanCreate } from "@/lib/hooks/useUsuario";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { cn } from "@/lib/utils";
import type { AetRelatorio, ClassificacaoRiscoAET } from "@/lib/supabase/types";

const CLASS_ORDER: ClassificacaoRiscoAET[] = [
  "Trivial",
  "De Atenção",
  "Moderado",
  "Alto",
  "Crítico",
];

const RISK_COLOR: Record<ClassificacaoRiscoAET, string> = {
  Trivial: "bg-gray-100 text-gray-700 border-gray-200",
  "De Atenção": "bg-blue-100 text-blue-700 border-blue-200",
  Moderado: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Alto: "bg-orange-100 text-orange-700 border-orange-200",
  Crítico: "bg-red-100 text-red-700 border-red-200",
};

const RISK_DOT: Record<ClassificacaoRiscoAET, string> = {
  Trivial: "bg-gray-400",
  "De Atenção": "bg-blue-500",
  Moderado: "bg-yellow-500",
  Alto: "bg-orange-500",
  Crítico: "bg-red-500",
};

const RISK_BAR: Record<ClassificacaoRiscoAET, string> = {
  Trivial: "bg-gray-300",
  "De Atenção": "bg-blue-400",
  Moderado: "bg-yellow-400",
  Alto: "bg-orange-400",
  Crítico: "bg-red-500",
};

function classificacaoMax(rel: AetRelatorio): ClassificacaoRiscoAET | null {
  const all = rel.setores.flatMap((s) => s.riscos.map((r) => r.classificacao_risco));
  return all.reduce<ClassificacaoRiscoAET | null>(
    (max, c) => (!max || CLASS_ORDER.indexOf(c) > CLASS_ORDER.indexOf(max) ? c : max),
    null,
  );
}

/** Card analítico — apenas visualização, sem botões operacionais */
function LaudoCard({ rel }: { rel: AetRelatorio }) {
  const riskMax = classificacaoMax(rel);
  const totalSetores = rel.setores.length;
  const totalCargos = rel.setores.reduce((acc, s) => acc + s.cargos.length, 0);
  const totalRiscos = rel.setores.reduce((acc, s) => acc + s.riscos.length, 0);
  const dataFmt = rel.data_elaboracao
    ? new Date(rel.data_elaboracao + "T00:00:00").toLocaleDateString("pt-BR")
    : null;

  return (
    <Link
      href={`/aet/${rel.id_relatorio}/setores`}
      className="group flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-verde-primary/30 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-gray-900 leading-snug">
          {rel.empresas?.nome_empresa ?? "Empresa não informada"}
        </p>
        {riskMax ? (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
              RISK_COLOR[riskMax],
            )}
          >
            <span className={cn("size-1.5 rounded-full", RISK_DOT[riskMax])} />
            {riskMax}
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-400">
            Sem riscos
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-gray-50 p-2 text-center">
          <p className="text-lg font-bold text-gray-800">{totalSetores}</p>
          <p className="text-[10px] text-gray-500">Setor{totalSetores !== 1 ? "es" : ""}</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-2 text-center">
          <p className="text-lg font-bold text-gray-800">{totalCargos}</p>
          <p className="text-[10px] text-gray-500">Cargo{totalCargos !== 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-2 text-center">
          <p className="text-lg font-bold text-gray-800">{totalRiscos}</p>
          <p className="text-[10px] text-gray-500">Risco{totalRiscos !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="min-w-0">
          {rel.responsavel_elaboracao && (
            <p className="truncate">{rel.responsavel_elaboracao}</p>
          )}
          {dataFmt && <p className="text-gray-400">{dataFmt}</p>}
        </div>
        <span className="flex shrink-0 items-center gap-0.5 text-verde-primary opacity-0 transition-opacity group-hover:opacity-100">
          Ver análise <ChevronRight className="size-3" />
        </span>
      </div>
    </Link>
  );
}

export default function AetDashboardPage() {
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const { data: relatorios = [], isLoading } = useAetRelatorios(empresaId);
  const canCreate = useCanCreate();

  const stats = useMemo(() => {
    const total = relatorios.length;
    const rascunho = relatorios.filter((r) => r.status === "RASCUNHO").length;
    const concluido = relatorios.filter((r) => r.status === "CONCLUIDO").length;
    const agora = new Date();
    const esteMes = relatorios.filter((r) => {
      const d = new Date(r.created_at);
      return d.getFullYear() === agora.getFullYear() && d.getMonth() === agora.getMonth();
    }).length;
    return { total, rascunho, concluido, esteMes };
  }, [relatorios]);

  /** Distribuição de risco máximo por laudo */
  const riskDist = useMemo(() => {
    const counts = {} as Record<ClassificacaoRiscoAET | "Sem riscos", number>;
    relatorios.forEach((r) => {
      const max = classificacaoMax(r);
      const key = max ?? "Sem riscos";
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return counts;
  }, [relatorios]);

  const rascunhos = relatorios.filter((r) => r.status === "RASCUNHO");
  const concluidos = relatorios.filter((r) => r.status === "CONCLUIDO");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header analítico */}
      <div className="rounded-2xl bg-gradient-to-br from-verde-dark via-verde-primary to-verde-accent p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="size-6 opacity-90" />
              <h1 className="text-2xl font-bold tracking-tight">Dashboard AET</h1>
            </div>
            <p className="text-sm text-white/70">
              Análise Ergonômica do Trabalho — NR-17 · Inteligência operacional
            </p>
          </div>
          {canCreate && (
            <Link
              href="/aet/novo"
              className="inline-flex items-center gap-2 self-start rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/25"
            >
              <Plus className="size-4" /> Novo Laudo
            </Link>
          )}
        </div>

        {/* KPI cards */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
            <p className="text-xs font-medium uppercase tracking-wider text-white/65">Total</p>
            <p className="mt-1 text-3xl font-bold">{stats.total}</p>
            <div className="mt-1 flex items-center gap-1 text-xs text-white/55">
              <Activity className="size-3" /> laudos
            </div>
          </div>
          <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
            <p className="text-xs font-medium uppercase tracking-wider text-white/65">Rascunho</p>
            <p className="mt-1 text-3xl font-bold">{stats.rascunho}</p>
            <div className="mt-1 flex items-center gap-1 text-xs text-white/55">
              <Clock className="size-3" /> em andamento
            </div>
          </div>
          <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
            <p className="text-xs font-medium uppercase tracking-wider text-white/65">Concluídos</p>
            <p className="mt-1 text-3xl font-bold">{stats.concluido}</p>
            <div className="mt-1 flex items-center gap-1 text-xs text-white/55">
              <CheckCircle2 className="size-3" /> finalizados
            </div>
          </div>
          <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
            <p className="text-xs font-medium uppercase tracking-wider text-white/65">Este mês</p>
            <p className="mt-1 text-3xl font-bold">{stats.esteMes}</p>
            <div className="mt-1 flex items-center gap-1 text-xs text-white/55">
              <Users className="size-3" /> criados
            </div>
          </div>
        </div>
      </div>

      {/* Filtro por empresa */}
      <div className="flex items-end gap-4">
        <div className="w-72">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-400">
            Filtrar por empresa
          </label>
          <EmpresaSelect value={empresaId} onChange={setEmpresaId} modulo="sst" />
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <LoadingSkeleton rows={6} />
        </div>
      ) : relatorios.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white p-16 text-center">
          <ClipboardCheck className="size-12 text-gray-200" />
          <p className="mt-3 font-medium text-gray-900">Nenhum laudo AET encontrado</p>
          <p className="mt-1 text-sm text-gray-500">
            {empresaId ? "Tente remover o filtro de empresa." : "Crie o primeiro laudo para começar."}
          </p>
          {canCreate && !empresaId && (
            <Link
              href="/aet/novo"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent"
            >
              <Plus className="size-4" /> Criar primeiro laudo
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Distribuição de risco — analítico */}
          {Object.keys(riskDist).length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Distribuição de Risco Ergonômico
              </h3>
              <div className="space-y-2.5">
                {CLASS_ORDER.filter((cls) => (riskDist[cls] ?? 0) > 0).map((cls) => {
                  const count = riskDist[cls] ?? 0;
                  const pct = Math.round((count / relatorios.length) * 100);
                  return (
                    <div key={cls} className="flex items-center gap-3">
                      <div className="flex w-28 shrink-0 items-center gap-1.5">
                        <span className={cn("size-2 rounded-full shrink-0", RISK_DOT[cls])} />
                        <span className="text-xs font-medium text-gray-600 truncate">{cls}</span>
                      </div>
                      <div className="flex-1 overflow-hidden rounded-full bg-gray-100" style={{ height: 6 }}>
                        <div
                          className={cn("h-full rounded-full transition-all duration-500", RISK_BAR[cls])}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex w-14 items-center justify-end gap-1">
                        <span className="text-xs font-bold text-gray-700">{count}</span>
                        <span className="text-xs text-gray-400">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
                {(riskDist["Sem riscos"] ?? 0) > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="flex w-28 shrink-0 items-center gap-1.5">
                      <span className="size-2 rounded-full shrink-0 bg-gray-200" />
                      <span className="text-xs font-medium text-gray-400">Sem riscos</span>
                    </div>
                    <div className="flex-1 overflow-hidden rounded-full bg-gray-100" style={{ height: 6 }}>
                      <div className="h-full rounded-full bg-gray-200" style={{ width: `${Math.round((riskDist["Sem riscos"] / relatorios.length) * 100)}%` }} />
                    </div>
                    <div className="flex w-14 items-center justify-end gap-1">
                      <span className="text-xs font-bold text-gray-400">{riskDist["Sem riscos"]}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Kanban de status — visão de acompanhamento */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-amber-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                  Em elaboração
                </h2>
                <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  {rascunhos.length}
                </span>
              </div>
              {rascunhos.length === 0 ? (
                <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-sm text-gray-400">
                  Nenhum rascunho
                </div>
              ) : (
                rascunhos.map((rel) => <LaudoCard key={rel.id_relatorio} rel={rel} />)
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-green-500" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                  Concluídos
                </h2>
                <span className="ml-auto rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  {concluidos.length}
                </span>
              </div>
              {concluidos.length === 0 ? (
                <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-sm text-gray-400">
                  Nenhum laudo concluído
                </div>
              ) : (
                concluidos.map((rel) => <LaudoCard key={rel.id_relatorio} rel={rel} />)
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
