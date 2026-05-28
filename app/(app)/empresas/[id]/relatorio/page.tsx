"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, Building2, ClipboardList } from "lucide-react";
import AssinaturaRelatorio from "@/components/ui/AssinaturaRelatorio";
import { useQuery } from "@tanstack/react-query";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import { useInspecoesByEmpresa } from "@/lib/hooks/useInspecao";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import StatusBadge from "@/components/inspecoes/StatusBadge";
import NivelBadge from "@/components/riscos/NivelBadge";
import RelatorioPrintHeader from "@/components/layout/RelatorioPrintHeader";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fmtData, formatCNPJ } from "@/lib/utils";
import { NIVEIS_RISCO, NIVEL_CONFIG } from "@/lib/constants";
import type { Risco } from "@/lib/supabase/types";

interface Props {
  params: Promise<{ id: string }>;
}

interface RiscosPorInspecao {
  [idInspecao: string]: Risco[];
}

export default function RelatorioConsolidadoPage({ params }: Props) {
  const { id } = use(params);
  const { data: empresa } = useEmpresa(id);
  const { data: inspecoes = [], isLoading: loadingInsp } =
    useInspecoesByEmpresa(id);

  const inspecoesValidas = useMemo(
    () => inspecoes.filter((i) => i.status !== "DELETADA"),
    [inspecoes]
  );

  // Busca todos os riscos de todas as inspeções da empresa de uma vez.
  const { data: riscos = [], isLoading: loadingRiscos } = useQuery({
    queryKey: ["empresa-todos-riscos", id],
    enabled: !!id && inspecoesValidas.length > 0,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("riscos")
        .select("*")
        .eq("id_empresa", id);
      if (error) throw error;
      return (data ?? []) as unknown as Risco[];
    },
  });

  const riscosPorInsp: RiscosPorInspecao = useMemo(() => {
    const acc: RiscosPorInspecao = {};
    for (const r of riscos) {
      const arr = acc[r.id_inspecao] ?? [];
      arr.push(r);
      acc[r.id_inspecao] = arr;
    }
    return acc;
  }, [riscos]);

  // Comparativo: contagem por nível, agrupado por revisão.
  const comparativo = useMemo(() => {
    return inspecoesValidas
      .slice()
      .sort((a, b) => (a.revisao ?? 0) - (b.revisao ?? 0))
      .map((insp) => {
        const lista = riscosPorInsp[insp.id_inspecao] ?? [];
        const counts: Record<string, number> = {
          Trivial: 0,
          Baixo: 0,
          Moderado: 0,
          Alto: 0,
          "Muito Alto": 0,
        };
        for (const r of lista) {
          const n = r.nivel_risco ?? "Baixo";
          counts[n] = (counts[n] ?? 0) + 1;
        }
        return { insp, counts, total: lista.length };
      });
  }, [inspecoesValidas, riscosPorInsp]);

  if (loadingInsp || loadingRiscos) return <LoadingSkeleton rows={8} />;

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between">
        <Link
          href={`/empresas/${id}`}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="size-4" /> Voltar
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent"
        >
          <Printer className="size-4" />
          Imprimir / Exportar PDF
        </button>
      </div>

      <article className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 print:border-0 print:p-0 print:shadow-none">
        <RelatorioPrintHeader
          titulo="Relatório Consolidado por Empresa"
          subtitulo={empresa?.nome_empresa ?? null}
          terciario={empresa?.cnpj ? `CNPJ: ${formatCNPJ(empresa.cnpj)}` : null}
        />

        {/* Header */}
        <header className="flex items-start gap-3 border-b border-gray-200 pb-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-verde-primary text-white">
            <Building2 className="size-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-500">
              Relatório Consolidado por Empresa
            </p>
            <h1 className="text-2xl font-bold text-gray-900">
              {empresa?.nome_empresa ?? "—"}
            </h1>
            <p className="text-sm text-gray-600">
              CNPJ: {formatCNPJ(empresa?.cnpj)}
              {empresa?.razao_social && <> · {empresa.razao_social}</>}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {inspecoesValidas.length} inspeção(ões) ·{" "}
              {riscos.length} risco(s) registrado(s)
            </p>
          </div>
        </header>

        {/* Comparativo entre revisões */}
        {comparativo.length === 0 ? (
          <div className="flex flex-col items-center p-8 text-center text-sm text-gray-500">
            <ClipboardList className="size-8 text-gray-400" />
            <p className="mt-2">
              Nenhuma inspeção registrada para esta empresa ainda.
            </p>
          </div>
        ) : (
          <>
            <section>
              <h2 className="mb-3 text-base font-semibold text-gray-900">
                Comparativo de Riscos por Revisão
              </h2>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">
                        Inspeção
                      </th>
                      <th className="px-3 py-2 text-center font-medium">
                        Rev.
                      </th>
                      <th className="px-3 py-2 text-left font-medium">Data</th>
                      <th className="px-3 py-2 text-left font-medium">
                        Status
                      </th>
                      {NIVEIS_RISCO.map((n) => (
                        <th
                          key={n}
                          className="px-3 py-2 text-center font-medium"
                          style={{ color: NIVEL_CONFIG[n].cor }}
                        >
                          {n}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-center font-medium">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {comparativo.map(({ insp, counts, total }) => (
                      <tr key={insp.id_inspecao} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-xs text-gray-600">
                          {insp.id_inspecao}
                        </td>
                        <td className="px-3 py-2 text-center font-semibold text-gray-900">
                          {insp.revisao}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {fmtData(insp.data_inspecao)}
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge status={insp.status} />
                        </td>
                        {NIVEIS_RISCO.map((n) => (
                          <td
                            key={n}
                            className="px-3 py-2 text-center font-medium"
                            style={{ color: NIVEL_CONFIG[n].cor }}
                          >
                            {counts[n] || ""}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-center font-bold text-gray-900">
                          {total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Detalhamento por inspeção */}
            <section>
              <h2 className="mb-3 text-base font-semibold text-gray-900">
                Detalhamento por Inspeção
              </h2>
              <div className="space-y-3">
                {comparativo.map(({ insp, total }) => {
                  const lista = riscosPorInsp[insp.id_inspecao] ?? [];
                  return (
                    <div
                      key={insp.id_inspecao}
                      className="rounded-lg border border-gray-200 print-avoid-break"
                    >
                      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            Revisão {insp.revisao}
                          </p>
                          <p className="text-xs text-gray-600">
                            {fmtData(insp.data_inspecao)} ·{" "}
                            {insp.responsavel ?? "—"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={insp.status} />
                          <span className="text-xs text-gray-500">
                            {total} risco(s)
                          </span>
                          <Link
                            href={`/inspecoes/${insp.id_inspecao}/relatorio`}
                            className="no-print text-xs font-medium text-verde-primary hover:underline"
                          >
                            Ver completo →
                          </Link>
                        </div>
                      </div>
                      {lista.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-gray-500">
                          Sem riscos registrados.
                        </p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead className="text-gray-500">
                            <tr>
                              <th className="px-3 py-1.5 text-left font-medium">
                                Tipo
                              </th>
                              <th className="px-3 py-1.5 text-left font-medium">
                                Agente
                              </th>
                              <th className="px-3 py-1.5 text-left font-medium">
                                Probab.
                              </th>
                              <th className="px-3 py-1.5 text-left font-medium">
                                Sever.
                              </th>
                              <th className="px-3 py-1.5 text-left font-medium">
                                Nível
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {lista.map((r) => (
                              <tr key={r.id_risco}>
                                <td className="px-3 py-1.5 text-gray-700">
                                  {r.tipo_risco}
                                </td>
                                <td className="px-3 py-1.5 font-medium text-gray-900">
                                  {r.agente ?? "—"}
                                </td>
                                <td className="px-3 py-1.5 text-gray-600">
                                  {r.probabilidade ?? "—"}
                                </td>
                                <td className="px-3 py-1.5 text-gray-600">
                                  {r.severidade ?? "—"}
                                </td>
                                <td className="px-3 py-1.5">
                                  <NivelBadge
                                    nivel={r.nivel_risco ?? "Baixo"}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        <AssinaturaRelatorio tabelaNome="empresas_relatorio" docId={id} />
      </article>
    </div>
  );
}
