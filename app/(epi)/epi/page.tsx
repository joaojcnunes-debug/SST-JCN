"use client";

import { HardHat } from "lucide-react";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import EpiGestao from "@/components/epi/EpiGestao";
import { useEpiStore } from "@/lib/epi/store";
import { useCanEdit } from "@/lib/hooks/useUsuario";

export default function EpiHomePage() {
  const empresaId = useEpiStore((s) => s.empresaId);
  const setEmpresa = useEpiStore((s) => s.setEmpresa);
  const canEdit = useCanEdit();

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-verde-primary/10 text-verde-primary">
          <HardHat className="size-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Gestão de EPI</h1>
          <p className="text-sm text-gray-600">
            Catálogo de EPI por empresa (vinculado ao CA), estoque e colaboradores.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">
          Empresa
        </label>
        <div className="max-w-md">
          <EmpresaSelect
            value={empresaId}
            onChange={setEmpresa}
            placeholder="Selecione a empresa…"
            allowAll
          />
        </div>
      </div>

      <EpiGestao empresaId={empresaId} canEdit={canEdit} />
    </div>
  );
}
