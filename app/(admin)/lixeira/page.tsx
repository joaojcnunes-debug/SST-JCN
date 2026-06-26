"use client";

import { useState } from "react";
import { Trash2, RotateCcw, Loader2 } from "lucide-react";
import {
  useLixeira,
  useRestaurarRegistro,
  type RegistroExcluido,
} from "@/lib/hooks/useLixeira";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

const TABELA_LABEL: Record<string, string> = {
  empresas: "Empresa",
  textos_padrao: "Texto Padrão",
  drps_texto_padrao: "Texto Padrão (DRPS)",
  anexos: "Anexo",
  inventario_maquinas: "Máquina",
  relatorios_conformidade: "Relatório de Conformidade",
  relatorios_nao_conformidade: "Relatório de Não Conformidade",
  analises_quimicos: "Análise de Químicos",
  apreciacoes_maquinas: "Apreciação NR-12",
  aep_relatorios: "AEP",
  aet_relatorios: "AET",
  drps_relatorios: "DRPS",
  inspecoes: "Inspeção",
  unidades: "Unidade",
  tipos_risco: "Tipo de Risco",
  matrizes_risco: "Matriz de Risco",
  modelos_risco: "Modelo de Risco",
  base_referencia_quimicos: "Base de Referência (Químicos)",
  usuarios: "Usuário",
};

function rotuloTabela(t: string) {
  return TABELA_LABEL[t] ?? t;
}

export default function LixeiraPage() {
  const { data: registros = [], isLoading } = useLixeira();
  const restaurar = useRestaurarRegistro();
  const [confirmar, setConfirmar] = useState<RegistroExcluido | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Trash2 className="size-5 text-gray-600" />
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Lixeira</h1>
          <p className="text-sm text-gray-500">
            Registros excluídos recentemente. Como admin, você pode restaurá-los.
            (Exclusões em cascata — ex.: itens de uma empresa — não são restauradas
            automaticamente.)
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <LoadingSkeleton rows={4} />
        </div>
      ) : registros.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
          A lixeira está vazia.
        </div>
      ) : (
        <ul className="reveal-up space-y-2">
          {registros.map((r) => (
            <li
              key={r.id}
              className="card-hover flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
            >
              <span className="inline-flex shrink-0 items-center rounded bg-gray-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                {rotuloTabela(r.tabela)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-800">
                  {r.rotulo || r.registro_id}
                </p>
                <p className="text-[11px] text-gray-500">
                  Excluído em {new Date(r.excluido_em).toLocaleString("pt-BR")}
                  {r.excluido_por ? ` por ${r.excluido_por}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmar(r)}
                disabled={restaurar.isPending}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-verde-primary bg-white px-3 py-1.5 text-sm font-semibold text-verde-primary hover:bg-verde-light disabled:opacity-50"
              >
                {restaurar.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="size-3.5" />
                )}
                Restaurar
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!confirmar}
        title="Restaurar registro?"
        description={
          confirmar
            ? `"${confirmar.rotulo || confirmar.registro_id}" (${rotuloTabela(confirmar.tabela)}) será reinserido no sistema.`
            : undefined
        }
        loading={restaurar.isPending}
        onConfirm={() => {
          if (!confirmar) return;
          restaurar.mutate(confirmar, { onSuccess: () => setConfirmar(null) });
        }}
        onCancel={() => setConfirmar(null)}
      />
    </div>
  );
}
