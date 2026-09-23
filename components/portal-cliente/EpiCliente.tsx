"use client";

import { HardHat } from "lucide-react";
import { usePortalEmpresa } from "@/lib/hooks/usePortalCliente";
import EpiGestao from "@/components/epi/EpiGestao";

/**
 * EPI no Portal do cliente: reusa o EpiGestao em contexto "cliente" (esconde NF-e e
 * Transferências) para a empresa vinculada ao usuário. Somente leitura.
 */
export default function EpiCliente() {
  const { data: empresa, isLoading } = usePortalEmpresa();

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">EPIs da minha empresa</h1>
        <p className="mt-1 text-sm text-gray-600">Catálogo, estoque, entregas e colaboradores{empresa ? ` de ${empresa.nome_empresa}` : ""}.</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Carregando…</p>
      ) : !empresa ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
          <HardHat className="mx-auto size-8 text-gray-400" />
          <p className="mt-2 text-sm font-medium text-gray-700">Nenhuma empresa vinculada ao seu acesso.</p>
          <p className="mt-1 text-xs text-gray-500">Fale com a JCN Consultoria para vincular sua empresa.</p>
        </div>
      ) : (
        <EpiGestao empresaId={empresa.id_empresa} canEdit={false} contexto="cliente" />
      )}
    </div>
  );
}
