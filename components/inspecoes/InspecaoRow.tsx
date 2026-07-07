"use client";

import Link from "next/link";
import { Pencil, ChartBar, Trash2 } from "lucide-react";
import StatusBadge from "./StatusBadge";
import { fmtData } from "@/lib/utils";
import { iniciais, corAvatar } from "@/lib/hooks/useGestao";
import type { Inspecao, InspecaoAssociado } from "@/lib/supabase/types";

export default function InspecaoRow({
  insp,
  associados = [],
  onDelete,
  onEditResponsavel,
  showEmpresa,
}: {
  insp: Inspecao;
  /** Associados à elaboração do Documento SGG desta inspeção. */
  associados?: InspecaoAssociado[];
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
        {(() => {
          // Une os associados (tabela nova) com quem assumiu a elaboração pelo fluxo
          // de status (elaboracao_responsavel) — assim inspeções antigas também mostram.
          const pessoas: { key: string; nome: string }[] = associados.map((a) => ({ key: a.id, nome: a.nome }));
          const nomes = new Set(pessoas.map((p) => p.nome.trim().toLowerCase()));
          const resp = insp.elaboracao_responsavel?.trim();
          if (resp && !nomes.has(resp.toLowerCase())) {
            pessoas.push({ key: `resp-${insp.id_inspecao}`, nome: resp });
          }
          if (pessoas.length === 0) return <span className="text-xs text-gray-300">—</span>;
          return (
            <div className="flex items-center -space-x-1.5">
              {pessoas.slice(0, 4).map((p) => (
                <span
                  key={p.key}
                  title={p.nome}
                  className="flex size-6 items-center justify-center rounded-full border-2 border-white text-[9px] font-bold text-white"
                  style={{ backgroundColor: corAvatar(p.nome) }}
                >
                  {iniciais(p.nome)}
                </span>
              ))}
              {pessoas.length > 4 && (
                <span
                  title={pessoas.slice(4).map((p) => p.nome).join(", ")}
                  className="flex size-6 items-center justify-center rounded-full border-2 border-white bg-gray-200 text-[9px] font-bold text-gray-600"
                >
                  +{pessoas.length - 4}
                </span>
              )}
            </div>
          );
        })()}
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
