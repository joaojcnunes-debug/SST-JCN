"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  ChartBar,
  FileText,
  Building2,
  ClipboardList,
  Layers,
} from "lucide-react";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import StatusBadge from "@/components/inspecoes/StatusBadge";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import { useInspecoesByEmpresa } from "@/lib/hooks/useInspecao";
import { fmtData, formatCNPJ } from "@/lib/utils";

export default function RelatoriosPage() {
  return (
    <Suspense fallback={null}>
      <RelatoriosInner />
    </Suspense>
  );
}

function RelatoriosInner() {
  const router = useRouter();
  const params = useSearchParams();
  const empresaParam = params.get("empresa");
  const [empresaId, setEmpresaId] = useState<string | null>(empresaParam);

  const { data: empresa } = useEmpresa(empresaId);
  const { data: inspecoes = [], isLoading } = useInspecoesByEmpresa(empresaId);

  // Mantém URL sincronizada (deep link da empresa selecionada)
  useEffect(() => {
    const sp = new URLSearchParams(params.toString());
    if (empresaId) sp.set("empresa", empresaId);
    else sp.delete("empresa");
    const next = sp.toString();
    router.replace(`/relatorios${next ? "?" + next : ""}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const inspecoesValidas = inspecoes.filter((i) => i.status !== "DELETADA");

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-verde-light text-verde-primary">
            <BarChart3 className="size-6" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">
              Central de Relatórios
            </h1>
            <p className="text-sm text-gray-600">
              Selecione uma empresa para acessar os relatórios disponíveis:
              <strong> Consolidado</strong> (comparativo entre revisões),
              <strong> Executivo</strong> (formato Chabra para apresentação) e
              <strong> PGR/NR-1</strong> (Inventário de Riscos técnico).
            </p>
          </div>
        </div>

        <div className="mt-4">
          <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Empresa
          </label>
          <div className="mt-1 max-w-xl">
            <EmpresaSelect value={empresaId} onChange={setEmpresaId} />
          </div>
        </div>
      </header>

      {!empresaId ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <Building2 className="size-10 text-gray-400" />
          <p className="mt-3 text-sm font-medium text-gray-900">
            Selecione uma empresa
          </p>
          <p className="text-xs text-gray-500">
            Os relatórios são organizados por empresa.
          </p>
        </div>
      ) : (
        <>
          {/* Card empresa */}
          {empresa && (
            <div className="rounded-xl border border-verde-border bg-verde-light/30 p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-verde-primary text-white">
                  <Building2 className="size-5" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">
                    {empresa.nome_empresa}
                  </p>
                  <p className="text-xs text-gray-600">
                    CNPJ: {formatCNPJ(empresa.cnpj)}
                    {empresa.razao_social && <> · {empresa.razao_social}</>}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Relatório consolidado (por empresa) */}
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
              Por empresa
            </h2>
            <Link
              href={`/empresas/${empresaId}/relatorio`}
              className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-verde-primary hover:shadow-md"
            >
              <div className="flex size-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700 transition-colors group-hover:bg-blue-100">
                <Layers className="size-6" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900">
                  Relatório Consolidado
                </p>
                <p className="text-sm text-gray-600">
                  Todas as inspeções desta empresa lado a lado, com
                  comparativo de riscos por revisão. Útil pra ver evolução
                  ao longo do tempo.
                </p>
              </div>
              <span className="text-sm font-medium text-verde-primary opacity-0 transition-opacity group-hover:opacity-100">
                Abrir →
              </span>
            </Link>
          </section>

          {/* Por inspeção */}
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
              Por inspeção (Executivo + PGR)
            </h2>
            {isLoading ? (
              <LoadingSkeleton rows={4} />
            ) : inspecoesValidas.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
                Esta empresa ainda não tem inspeções cadastradas.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium">
                        Revisão
                      </th>
                      <th className="px-4 py-2.5 text-left font-medium">
                        Data
                      </th>
                      <th className="px-4 py-2.5 text-left font-medium">
                        Responsável
                      </th>
                      <th className="px-4 py-2.5 text-left font-medium">
                        Status
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        Relatórios
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {inspecoesValidas.map((i) => (
                      <tr key={i.id_inspecao} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-xs text-gray-500">
                            Rev. {i.revisao}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-700">
                          {fmtData(i.data_inspecao)}
                        </td>
                        <td className="px-4 py-2.5 text-gray-700">
                          {i.responsavel ?? "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={i.status} />
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end gap-1.5">
                            <Link
                              href={`/inspecoes/${i.id_inspecao}/relatorio`}
                              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-verde-light hover:border-verde-primary hover:text-verde-primary"
                              title="Relatório executivo (capa Chabra)"
                            >
                              <ChartBar className="size-3.5" />
                              Executivo
                            </Link>
                            <Link
                              href={`/inspecoes/${i.id_inspecao}/pgr`}
                              className="inline-flex items-center gap-1 rounded-md border border-amber-warning bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-warning hover:bg-amber-100"
                              title="PGR / Inventário NR-1"
                            >
                              <FileText className="size-3.5" />
                              PGR
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-xs text-gray-500">
              <ClipboardList className="mr-1 inline size-3" />
              {inspecoesValidas.length} inspeção(ões) ·{" "}
              <strong>Executivo</strong> tem capa elegante para apresentação ·{" "}
              <strong>PGR</strong> é A4 paisagem para auditoria SST.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
