"use client";

import { Pencil, Trash2, Copy } from "lucide-react";
import NivelBadge from "./NivelBadge";
import type { NivelRisco, Risco } from "@/lib/supabase/types";

interface Props {
  risco: Risco;
  setorNome?: string;
  onEdit?: (r: Risco) => void;
  onDelete?: (r: Risco) => void;
  onCopy?: (r: Risco) => void;
  readOnly?: boolean;
}

export default function RiscoRow({
  risco,
  setorNome,
  onEdit,
  onDelete,
  onCopy,
  readOnly,
}: Props) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-2 font-medium text-gray-900">
        {risco.agente ?? "—"}
      </td>
      <td className="px-4 py-2 text-gray-600">{setorNome ?? "—"}</td>
      <td className="px-4 py-2 text-gray-600">{risco.probabilidade ?? "—"}</td>
      <td className="px-4 py-2 text-gray-600">{risco.severidade ?? "—"}</td>
      <td className="px-4 py-2">
        <NivelBadge nivel={(risco.nivel_risco as NivelRisco) ?? "Baixo"} />
      </td>
      <td className="px-4 py-2">
        <div className="flex justify-end gap-1">
          {!readOnly && (
            <>
              <button
                type="button"
                onClick={() => onEdit?.(risco)}
                className="rounded p-1.5 text-gray-500 hover:bg-verde-light hover:text-verde-primary"
                title="Editar"
              >
                <Pencil className="size-4" />
              </button>
              {onCopy && (
                <button
                  type="button"
                  onClick={() => onCopy(risco)}
                  className="rounded p-1.5 text-gray-500 hover:bg-blue-50 hover:text-blue-700"
                  title="Duplicar"
                >
                  <Copy className="size-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onDelete?.(risco)}
                className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-alert"
                title="Excluir"
              >
                <Trash2 className="size-4" />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
