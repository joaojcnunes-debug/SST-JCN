"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Printer, Trash2, AlertTriangle } from "lucide-react";
import { useAepRelatorios, useExcluirAep, riscoMaximoRelatorio, CLASS_COLOR_AEP, STATUS_LABEL_AEP } from "@/lib/hooks/useAep";
import { useCanCreate, useCanDelete } from "@/lib/hooks/useUsuario";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import type { AepRelatorio, ClassificacaoRiscoAET } from "@/lib/supabase/types";

const RISCO_DOT: Record<ClassificacaoRiscoAET, string> = {
  Trivial: "bg-green-400",
  "De Atenção": "bg-yellow-400",
  Moderado: "bg-orange-400",
  Alto: "bg-red-400",
  Crítico: "bg-red-600",
};

export default function AepListaPage() {
  const router = useRouter();
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [confirmarExcluir, setConfirmarExcluir] = useState<AepRelatorio | null>(null);
  const { data: relatorios = [], isLoading } = useAepRelatorios(empresaId);
  const excluir = useExcluirAep();
  const canCreate = useCanCreate();
  const canDelete = useCanDelete();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">AEP – Análise Ergonômica Preliminar</h1>
          <p className="text-sm text-gray-500">Triagem ergonômica inicial integrada ao GRO/PGR</p>
        </div>
        {canCreate && (
          <button
            onClick={() => router.push("/aep/novo")}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700"
          >
            <Plus className="size-4" /> Nova Análise
          </button>
        )}
      </div>

      <div className="max-w-xs">
        <EmpresaSelect
          value={empresaId}
          onChange={setEmpresaId}
          placeholder="Filtrar por empresa..."
          modulo="aep"
          allowAll
        />
      </div>

      {isLoading && <LoadingSkeleton rows={4} />}

      {!isLoading && relatorios.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <p className="text-sm text-gray-500">Nenhuma análise encontrada.</p>
          {canCreate && (
            <button
              onClick={() => router.push("/aep/novo")}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <Plus className="size-4" /> Nova Análise
            </button>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {relatorios.map((rel) => {
          const empresa = rel.empresas as { nome_empresa?: string } | null;
          const rMax = riscoMaximoRelatorio(rel);
          const totalSetores = rel.setores.length;
          const totalRiscos = rel.setores.reduce((a, s) => a + s.riscos.length, 0);
          const necessitaAet = rel.setores.some((s) => s.necessita_aet);

          return (
            <div
              key={rel.id_relatorio}
              className="group relative flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="truncate font-semibold text-gray-900">
                    {empresa?.nome_empresa ?? "—"}
                  </p>
                  <p className="text-xs text-gray-500">
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
                <div className="flex items-center gap-1.5 rounded-lg bg-orange-50 border border-orange-200 px-3 py-1.5 text-xs font-semibold text-orange-700">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  Requer elaboração de AET completa
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-gray-50 p-2 text-center">
                  <p className="text-lg font-bold text-gray-800">{totalSetores}</p>
                  <p className="text-gray-500">Setor(es)</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-2 text-center">
                  <p className="text-lg font-bold text-gray-800">{totalRiscos}</p>
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
                {canDelete && (
                  <button
                    onClick={() => setConfirmarExcluir(rel)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!confirmarExcluir}
        title="Excluir análise AEP?"
        description={`Esta ação não pode ser desfeita. A análise de "${(confirmarExcluir?.empresas as { nome_empresa?: string } | null)?.nome_empresa ?? ""}" será removida permanentemente.`}
        variant="danger"
        loading={excluir.isPending}
        onConfirm={() => {
          if (confirmarExcluir) {
            excluir.mutate(confirmarExcluir.id_relatorio, {
              onSuccess: () => setConfirmarExcluir(null),
            });
          }
        }}
        onCancel={() => setConfirmarExcluir(null)}
      />
    </div>
  );
}
