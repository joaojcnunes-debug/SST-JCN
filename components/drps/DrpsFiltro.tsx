"use client";

import { useMemo } from "react";
import { useDrpsStore } from "@/lib/drps/store";
import { useDrpsRespondentes } from "@/lib/hooks/useDrps";
import { listarSetores } from "@/lib/drps/calculos";

/**
 * Filtro de setor (cada relatório DRPS pode ter respondentes de vários
 * setores). Aparece no topo das telas do editor de relatório.
 */
export default function DrpsFiltro({ idRelatorio }: { idRelatorio: string }) {
  const setor = useDrpsStore((s) => s.setor);
  const setSetor = useDrpsStore((s) => s.setSetor);

  const { data: respondentes = [] } = useDrpsRespondentes(idRelatorio);
  const setores = useMemo(() => listarSetores(respondentes), [respondentes]);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2 shadow-sm">
      <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        Setor
      </label>
      <select
        value={setor}
        onChange={(e) => setSetor(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
      >
        <option value="Todos">Todos os setores</option>
        {setores.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <span className="text-xs text-gray-500">
        {respondentes.length} respondente(s) no relatório
      </span>
    </div>
  );
}
