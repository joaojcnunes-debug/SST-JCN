"use client";

import { MapPin } from "lucide-react";
import type { Unidade } from "@/lib/supabase/types";

/** Seletor de unidade do cabeçalho das telas de detalhe do Dashboard (useFiltroUnidadeDashboard). */
export default function FiltroUnidade({
  idUnidade,
  unidades,
  onChange,
}: {
  idUnidade: string;
  unidades: readonly Unidade[];
  onChange: (id: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
      <MapPin className="size-3.5 text-verde-primary" />
      Unidade
      <select
        value={idUnidade}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800 focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
        aria-label="Filtrar por unidade"
      >
        <option value="">Todas as unidades</option>
        {unidades.map((u) => (
          <option key={u.id_unidade} value={u.id_unidade}>
            {u.nome}
          </option>
        ))}
      </select>
    </label>
  );
}
