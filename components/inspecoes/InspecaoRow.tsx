"use client";

import Link from "next/link";
import { Pencil, ChartBar, Trash2 } from "lucide-react";
import StatusBadge from "./StatusBadge";
import { fmtData } from "@/lib/utils";
import type { Inspecao } from "@/lib/supabase/types";

export default function InspecaoRow({
  insp,
  onDelete,
  onEditResponsavel,
  showEmpresa,
}: {
  insp: Inspecao;
  onDelete?: (insp: Inspecao) => void;
  /** Quando fornecido (apenas Admin), mostra o lápis para editar o responsável. */
  onEditResponsavel?: (insp: Inspecao) => void;
  showEmpresa?: boolean;
}) {
  return (
    <tr className="border-b border-gray-50 transition-colors hover:bg-verde-light/25 last:border-b-0">
      <td className="px-4 py-3 font-mono text-xs text-gray-400">
        {insp.id_inspecao}
      </td>
      {showEmpresa && (
        <td className="px-4 py-3 font-medium text-gray-800">
          {insp.empresas?.nome_empresa ?? "—"}
        </td>
      )}
      <td className="px-4 py-3 text-center">
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
          {insp.revisao}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{fmtData(insp.data_inspecao)}</td>
      <td className="px-4 py-3 text-sm text-gray-700">
        <span className="inline-flex items-center gap-1.5">
          {insp.responsavel ?? "—"}
          {onEditResponsavel && (
            <button
              type="button"
              onClick={() => onEditResponsavel(insp)}
              className="flex size-6 items-center justify-center rounded-md text-gray-300 transition hover:bg-verde-light hover:text-verde-primary"
              title="Editar responsável (Admin)"
            >
              <Pencil className="size-3" />
            </button>
          )}
        </span>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={insp.status} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/inspecoes/${insp.id_inspecao}`}
            className="flex size-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-verde-light hover:text-verde-primary"
            title="Editar inspeção"
          >
            <Pencil className="size-3.5" />
          </Link>
          <Link
            href={`/inspecoes/${insp.id_inspecao}/relatorio`}
            className="flex size-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-sky-50 hover:text-sky-600"
            title="Ver relatório"
          >
            <ChartBar className="size-3.5" />
          </Link>
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(insp)}
              className="flex size-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-500"
              title="Excluir inspeção"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
