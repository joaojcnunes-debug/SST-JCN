"use client";

import Link from "next/link";
import { Pencil, ChartBar, Trash2 } from "lucide-react";
import StatusBadge from "./StatusBadge";
import { fmtData } from "@/lib/utils";
import type { Inspecao } from "@/lib/supabase/types";

export default function InspecaoRow({
  insp,
  onDelete,
  showEmpresa,
}: {
  insp: Inspecao;
  /** Quando setado, mostra botão de excluir. Use só para Admin. */
  onDelete?: (insp: Inspecao) => void;
  showEmpresa?: boolean;
}) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-2.5 font-mono text-xs text-gray-600">
        {insp.id_inspecao}
      </td>
      {showEmpresa && (
        <td className="px-4 py-2.5 text-gray-700">
          {insp.empresas?.nome_empresa ?? "—"}
        </td>
      )}
      <td className="px-4 py-2.5 text-center text-gray-700">{insp.revisao}</td>
      <td className="px-4 py-2.5 text-gray-600">{fmtData(insp.data_inspecao)}</td>
      <td className="px-4 py-2.5 text-gray-700">{insp.responsavel ?? "—"}</td>
      <td className="px-4 py-2.5">
        <StatusBadge status={insp.status} />
      </td>
      <td className="px-4 py-2.5">
        <div className="flex justify-end gap-1">
          <Link
            href={`/inspecoes/${insp.id_inspecao}`}
            className="rounded p-1.5 text-gray-500 hover:bg-verde-light hover:text-verde-primary"
            title="Editar"
          >
            <Pencil className="size-4" />
          </Link>
          <Link
            href={`/inspecoes/${insp.id_inspecao}/relatorio`}
            className="rounded p-1.5 text-gray-500 hover:bg-blue-50 hover:text-blue-700"
            title="Relatório"
          >
            <ChartBar className="size-4" />
          </Link>
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(insp)}
              className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-alert"
              title="Excluir inspeção (Admin)"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
