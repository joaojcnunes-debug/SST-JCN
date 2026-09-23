"use client";

import { useState } from "react";
import { HardHat } from "lucide-react";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import EpiGestao from "@/components/epi/EpiGestao";
import { useCanEdit } from "@/lib/hooks/useUsuario";

/** Contexto interno: escolhe a empresa e gerencia o EPI dela. */
export default function EpiPage() {
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const canEdit = useCanEdit();

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Gestão de EPI</h1>
        <p className="mt-1 text-sm text-gray-600">Catálogo, estoque e colaboradores por empresa. Entregas, NF-e e transferências chegam nas próximas fases.</p>
      </div>

      <div className="max-w-md">
        <label className="mb-1 block text-xs font-medium text-gray-600">Empresa</label>
        <EmpresaSelect value={empresaId} onChange={setEmpresaId} placeholder="Selecione a empresa…" />
      </div>

      {empresaId ? (
        <EpiGestao empresaId={empresaId} canEdit={canEdit} />
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
          <HardHat className="mx-auto size-8 text-gray-400" />
          <p className="mt-2 text-sm font-medium text-gray-700">Selecione uma empresa</p>
          <p className="mt-1 text-xs text-gray-500">Escolha a empresa acima para ver o catálogo e o estoque de EPI.</p>
        </div>
      )}
    </div>
  );
}
