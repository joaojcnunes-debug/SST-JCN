"use client";

import { useMemo } from "react";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import { useDrpsStore } from "@/lib/drps/store";
import { useDrpsRespondentes } from "@/lib/hooks/useDrps";
import { listarSetores } from "@/lib/drps/calculos";

/**
 * Filtro padrão do módulo Psicossocial — empresa (obrigatória) e setor
 * (opcional, "Todos" por padrão). Usado no topo de praticamente todas as
 * abas do DRPS.
 */
export default function DrpsFiltro({
  obrigatorio = true,
}: {
  obrigatorio?: boolean;
}) {
  const idEmpresa = useDrpsStore((s) => s.idEmpresa);
  const setor = useDrpsStore((s) => s.setor);
  const setIdEmpresa = useDrpsStore((s) => s.setIdEmpresa);
  const setSetor = useDrpsStore((s) => s.setSetor);

  const { data: respondentes = [] } = useDrpsRespondentes(idEmpresa);
  const setores = useMemo(() => listarSetores(respondentes), [respondentes]);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
      <div className="flex-1">
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Empresa {obrigatorio && <span className="text-red-alert">*</span>}
        </label>
        <EmpresaSelect value={idEmpresa} onChange={setIdEmpresa} />
      </div>
      <div className="sm:w-64">
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Setor
        </label>
        <select
          value={setor}
          onChange={(e) => setSetor(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
        >
          <option value="Todos">Todos os setores</option>
          {setores.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
