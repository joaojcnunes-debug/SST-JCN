"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Eye,
  LayoutDashboard,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAetRelatorios, useExcluirAet } from "@/lib/hooks/useAet";
import { useCanCreate, useCanDelete } from "@/lib/hooks/useUsuario";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
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
  Trivial: "bg-gray-100 text-gray-700",
  "De Atenção": "bg-blue-100 text-blue-700",
  Moderado: "bg-yellow-100 text-yellow-700",
  Alto: "bg-orange-100 text-orange-700",
  Crítico: "bg-red-100 text-red-700",
};

const RISK_DOT: Record<ClassificacaoRiscoAET, string> = {
  Trivial: "bg-gray-400",
  "De Atenção": "bg-blue-500",
  Moderado: "bg-yellow-500",
  Alto: "bg-orange-500",
  Crítico: "bg-red-500",
};

function classificacaoMax(rel: AetRelatorio): ClassificacaoRiscoAET | null {
  const all = rel.setores.flatMap((s) => s.riscos.map((r) => r.classificacao_risco));
  return all.reduce<ClassificacaoRiscoAET | null>(
    (max, c) => (!max || CLASS_ORDER.indexOf(c) > CLASS_ORDER.indexOf(max) ? c : max),
    null,
  );
}

function LaudoCard({
  rel,
  canDelete,
  onDelete,
}: {
  rel: AetRelatorio;
  canDelete: boolean;
  onDelete: (rel: AetRelatorio) => void;
}) {
  const riskMax = classificacaoMax(rel);
  const totalSetores = rel.setores.length;
  const totalCargos = rel.setores.reduce((acc, s) => acc + s.cargos.length, 0);
  const totalRiscos = rel.setores.reduce((acc, s) => acc + s.riscos.length, 0);
  const dataFmt = rel.data_elaboracao
    ? new Date(rel.data_elaboracao + "T00:00:00").toLocaleDateString("pt-BR")
    : null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-gray-900 leading-snug">
          {rel.empresas?.nome_empresa ?? "Empresa não informada"}
        </p>
        {riskMax ? (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              RISK_COLOR[riskMax],
            )}
          >
            <span className={cn("size-1.5 rounded-full", RISK_DOT[riskMax])} />
            {riskMax}
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            Sem riscos
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-gray-50 p-2 text-center">
          <p className="text-lg font-bold text-gray-800">{totalSetores}</p>
          <p className="text-xs text-gray-500">Setor{totalSetores !== 1 ? "es" : ""}</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-2 text-center">
          <p className="text-lg font-bold text-gray-800">{totalCargos}</p>
          <p className="text-xs text-gray-500">Cargo{totalCargos !== 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-2 text-center">
          <p className="text-lg font-bold text-gray-800">{totalRiscos}</p>
          <p className="text-xs text-gray-500">Risco{totalRiscos !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="space-y-1 text-xs text-gray-500">
        {rel.responsavel_elaboracao && (
          <p className="truncate">
            <span className="font-medium text-gray-700">Resp.:</span>{" "}
            {rel.responsavel_elaboracao}
          </p>
        )}
        {dataFmt && (
          <p>
            <span className="font-medium text-gray-700">Data:</span> {dataFmt}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Link
          href={`/aet/${rel.id_relatorio}/laudo`}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-verde-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-verde-accent"
        >
          <Eye className="size-3.5" /> Abrir Laudo
        </Link>
        <Link
          href={`/aet/${rel.id_relatorio}/setores`}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <ClipboardCheck className="size-3.5" /> Setores
        </Link>
        {canDelete && (
          <button
            type="button"
            onClick={() => onDelete(rel)}
            className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-500 hover:bg-red-100"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function AetDashboardPage() {
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<AetRelatorio | null>(null);

  const { data: relatorios = [], isLoading } = useAetRelatorios(empresaId);
  const excluir = useExcluirAet();
  const canCreate = useCanCreate();
  const canDelete = useCanDelete();

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

  const rascunhos = relatorios.filter((r) => r.status === "RASCUNHO");
  const concluidos = relatorios.filter((r) => r.status === "CONCLUIDO");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-verde-dark via-verde-primary to-verde-accent p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="size-6 opacity-90" />
              <h1 className="text-2xl font-bold tracking-tight">Dashboard AET</h1>
            </div>
            <p className="text-sm text-white/75">
              Análise Ergonômica do Trabalho — NR-17
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
            <p className="text-xs font-medium uppercase tracking-wider text-white/70">
              Total
            </p>
            <p className="mt-1 text-3xl font-bold">{stats.total}</p>
            <div className="mt-1 flex items-center gap-1 text-xs text-white/60">
              <Activity className="size-3" /> laudos
            </div>
          </div>
          <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
            <p className="text-xs font-medium uppercase tracking-wider text-white/70">
              Rascunho
            </p>
            <p className="mt-1 text-3xl font-bold">{stats.rascunho}</p>
            <div className="mt-1 flex items-center gap-1 text-xs text-white/60">
              <Clock className="size-3" /> em andamento
            </div>
          </div>
          <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
            <p className="text-xs font-medium uppercase tracking-wider text-white/70">
              Concluídos
            </p>
            <p className="mt-1 text-3xl font-bold">{stats.concluido}</p>
            <div className="mt-1 flex items-center gap-1 text-xs text-white/60">
              <CheckCircle2 className="size-3" /> finalizados
            </div>
          </div>
          <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
            <p className="text-xs font-medium uppercase tracking-wider text-white/70">
              Este mês
            </p>
            <p className="mt-1 text-3xl font-bold">{stats.esteMes}</p>
            <div className="mt-1 flex items-center gap-1 text-xs text-white/60">
              <Users className="size-3" /> criados
            </div>
          </div>
        </div>
      </div>

      {/* Filtro */}
      <div className="flex items-end gap-4">
        <div className="w-72">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-500">
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Coluna Rascunho */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-amber-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-600">
                Rascunho
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
              rascunhos.map((rel) => (
                <LaudoCard
                  key={rel.id_relatorio}
                  rel={rel}
                  canDelete={canDelete}
                  onDelete={setConfirmDel}
                />
              ))
            )}
          </div>

          {/* Coluna Concluído */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-green-500" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-600">
                Concluído
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
              concluidos.map((rel) => (
                <LaudoCard
                  key={rel.id_relatorio}
                  rel={rel}
                  canDelete={canDelete}
                  onDelete={setConfirmDel}
                />
              ))
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDel}
        title="Excluir laudo AET?"
        description={
          confirmDel
            ? `O laudo da empresa "${confirmDel.empresas?.nome_empresa ?? ""}" será excluído permanentemente.`
            : undefined
        }
        variant="danger"
        loading={excluir.isPending}
        onConfirm={() => {
          if (confirmDel) {
            excluir.mutate(confirmDel.id_relatorio, {
              onSuccess: () => {
                toast.success("Laudo excluído");
                setConfirmDel(null);
              },
              onError: (e: Error) => toast.error(e.message),
            });
          }
        }}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}
