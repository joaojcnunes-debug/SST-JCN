"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Printer } from "lucide-react";
import { useAepRelatorios, riscoMaximoRelatorio, CLASS_COLOR_AEP, STATUS_LABEL_AEP } from "@/lib/hooks/useAep";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import type { ClassificacaoRiscoAET } from "@/lib/supabase/types";

const RISCO_DOT: Record<ClassificacaoRiscoAET, string> = {
  Trivial: "bg-green-400",
  "De Atenção": "bg-yellow-400",
  Moderado: "bg-orange-400",
  Alto: "bg-red-400",
  Crítico: "bg-red-600",
};

export default function AepDashboardPage() {
  const router = useRouter();
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const { data: relatorios = [], isLoading } = useAepRelatorios(empresaId);

  const totalAnalises = relatorios.length;
  const comAet = relatorios.filter((r) => r.setores.some((s) => s.necessita_aet)).length;
  const concluidos = relatorios.filter((r) => r.status === "CONCLUIDO").length;
  const totalRiscos = relatorios.reduce((a, r) => a + r.setores.reduce((b, s) => b + s.riscos.length, 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard AEP</h1>
          <p className="text-sm text-gray-500">Visão geral das análises ergonômicas preliminares</p>
        </div>
        <div className="w-56">
          <EmpresaSelect value={empresaId} onChange={setEmpresaId} placeholder="Todas as empresas" modulo="aep" allowAll />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Análises",     value: totalAnalises, color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
          { label: "Concluídas",   value: concluidos,    color: "bg-blue-50 border-blue-200 text-blue-700" },
          { label: "Requer AET",   value: comAet,        color: "bg-orange-50 border-orange-200 text-orange-700" },
          { label: "Riscos Ident.", value: totalRiscos,  color: "bg-gray-50 border-gray-200 text-gray-700" },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-xl border p-4 text-center ${color}`}>
            <p className="text-3xl font-bold">{value}</p>
            <p className="text-xs font-medium mt-1">{label}</p>
          </div>
        ))}
      </div>

      {isLoading && <LoadingSkeleton rows={4} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {relatorios.map((rel) => {
          const empresa = rel.empresas as { nome_empresa?: string } | null;
          const rMax = riscoMaximoRelatorio(rel);
          const necessitaAet = rel.setores.some((s) => s.necessita_aet);
          const totalSetores = rel.setores.length;
          const totalRiscosRel = rel.setores.reduce((a, s) => a + s.riscos.length, 0);

          return (
            <div
              key={rel.id_relatorio}
              className="group flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-gray-900">{empresa?.nome_empresa ?? "—"}</p>
                  <p className="text-xs text-gray-400">
                    {rel.data_elaboracao
                      ? new Date(rel.data_elaboracao).toLocaleDateString("pt-BR")
                      : "Sem data"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {rMax && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${CLASS_COLOR_AEP[rMax]}`}>
                      <span className={`size-1.5 rounded-full ${RISCO_DOT[rMax]}`} />
                      {rMax}
                    </span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${rel.status === "CONCLUIDO" ? "bg-emerald-100 text-emerald-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {STATUS_LABEL_AEP[rel.status]}
                  </span>
                </div>
              </div>

              {necessitaAet && (
                <div className="flex items-center gap-1.5 rounded-lg bg-orange-50 border border-orange-200 px-2 py-1.5 text-xs font-semibold text-orange-700">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  Requer AET completa
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-gray-50 p-2 text-center">
                  <p className="text-lg font-bold text-gray-800">{totalSetores}</p>
                  <p className="text-gray-500">Setor(es)</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-2 text-center">
                  <p className="text-lg font-bold text-gray-800">{totalRiscosRel}</p>
                  <p className="text-gray-500">Risco(s)</p>
                </div>
              </div>

              <div className="flex gap-2 mt-auto pt-2 border-t border-gray-100">
                <button
                  onClick={() => router.push(`/aep/${rel.id_relatorio}/setores`)}
                  className="flex-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  Editar
                </button>
                <button
                  onClick={() => router.push(`/aep/${rel.id_relatorio}/laudo`)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                >
                  <Printer className="size-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!isLoading && relatorios.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <p className="text-sm text-gray-500">Nenhuma análise encontrada para este filtro.</p>
        </div>
      )}
    </div>
  );
}
