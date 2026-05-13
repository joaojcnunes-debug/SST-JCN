"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  FileText,
  ArrowRight,
  CircleDashed,
  Activity,
  CheckCircle2,
  Building2,
} from "lucide-react";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import {
  useDrpsRelatoriosGeral,
  type DrpsRelatorioComEmpresa,
} from "@/lib/hooks/useDrps";
import { fmtData, formatCNPJ } from "@/lib/utils";
import type { StatusRelatorio } from "@/lib/drps/types";

interface ColunaConfig {
  status: Extract<StatusRelatorio, "RASCUNHO" | "EM_ANDAMENTO" | "CONCLUIDO">;
  titulo: string;
  descricao: string;
  cor: string;
  bg: string;
  border: string;
  Icone: typeof CircleDashed;
}

const COLUNAS: ColunaConfig[] = [
  {
    status: "RASCUNHO",
    titulo: "Rascunhos",
    descricao: "Relatórios criados ainda sem dados",
    cor: "#6b7280",
    bg: "#f3f4f6",
    border: "#d1d5db",
    Icone: CircleDashed,
  },
  {
    status: "EM_ANDAMENTO",
    titulo: "Em andamento",
    descricao: "Coleta ou análise em curso",
    cor: "#b45309",
    bg: "#fffbeb",
    border: "#fcd34d",
    Icone: Activity,
  },
  {
    status: "CONCLUIDO",
    titulo: "Concluídos",
    descricao: "Análises finalizadas pelo psicólogo",
    cor: "#15803d",
    bg: "#f0fdf4",
    border: "#86efac",
    Icone: CheckCircle2,
  },
];

export default function DashboardGeralPage() {
  const { data: relatorios = [], isLoading } = useDrpsRelatoriosGeral();

  const porStatus = useMemo(() => {
    const map: Record<string, DrpsRelatorioComEmpresa[]> = {
      RASCUNHO: [],
      EM_ANDAMENTO: [],
      CONCLUIDO: [],
    };
    for (const r of relatorios) {
      if (map[r.status]) map[r.status].push(r);
    }
    return map;
  }, [relatorios]);

  const empresasUnicas = useMemo(() => {
    const set = new Set<string>();
    for (const r of relatorios) set.add(r.id_empresa);
    return set.size;
  }, [relatorios]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dashboard Geral</h1>
        <p className="text-sm text-gray-600">
          Visão consolidada do status dos relatórios DRPS por empresa.
          {!isLoading && (
            <>
              {" "}
              <strong>{relatorios.length}</strong> relatório(s) em{" "}
              <strong>{empresasUnicas}</strong> empresa(s).
            </>
          )}
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <LoadingSkeleton rows={5} />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {COLUNAS.map((c) => {
            const items = porStatus[c.status] ?? [];
            return (
              <Coluna key={c.status} config={c} items={items} />
            );
          })}
        </div>
      )}
    </div>
  );
}

function Coluna({
  config,
  items,
}: {
  config: ColunaConfig;
  items: DrpsRelatorioComEmpresa[];
}) {
  const { titulo, descricao, cor, bg, border, Icone } = config;

  return (
    <section
      className="flex h-full flex-col overflow-hidden rounded-xl border bg-white shadow-sm"
      style={{ borderColor: border }}
    >
      <header
        className="flex items-start justify-between gap-2 border-b px-4 py-3"
        style={{ backgroundColor: bg, borderColor: border }}
      >
        <div className="flex items-start gap-2">
          <Icone className="mt-0.5 size-5" style={{ color: cor }} />
          <div>
            <h2
              className="text-sm font-bold uppercase tracking-wider"
              style={{ color: cor }}
            >
              {titulo}
            </h2>
            <p className="text-[10px] text-gray-600">{descricao}</p>
          </div>
        </div>
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
          style={{ backgroundColor: cor }}
        >
          {items.length}
        </span>
      </header>

      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-xs italic text-gray-400">
          Nenhum relatório nesse status.
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-gray-100 overflow-auto">
          {items.map((r) => (
            <li key={r.id_relatorio}>
              <Link
                href={`/psicossocial/${r.id_relatorio}/dashboard`}
                className="block px-4 py-3 hover:bg-gray-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                      <Building2 className="size-3" />
                      <span className="truncate">
                        {r.empresa_nome ?? "—"}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs font-mono text-gray-700">
                      {r.empresa_cnpj ? formatCNPJ(r.empresa_cnpj) : "—"}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2 text-xs">
                      <FileText className="size-3.5 text-verde-primary" />
                      <strong className="text-verde-primary">
                        Rev. {r.revisao}
                      </strong>
                      {r.data_elaboracao && (
                        <span className="text-gray-500">
                          ·{" "}
                          {new Date(
                            r.data_elaboracao + "T00:00:00"
                          ).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </div>
                    {r.responsavel_tecnico && (
                      <p className="mt-0.5 truncate text-[11px] text-gray-600">
                        {r.responsavel_tecnico}
                        {r.crp && (
                          <span className="text-gray-400"> · CRP {r.crp}</span>
                        )}
                      </p>
                    )}
                    <p className="mt-0.5 text-[10px] text-gray-400">
                      Atualizado em {fmtData(r.updated_at ?? r.created_at)}
                    </p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-gray-400" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
