"use client";

import { useState } from "react";
import {
  Download,
  FileText,
  BadgeCheck,
  Filter,
  RefreshCw,
} from "lucide-react";
import { usePdfsGerados } from "@/lib/hooks/usePdfsGerados";
import { cn } from "@/lib/utils";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";

const MODULOS: { value: string; label: string }[] = [
  { value: "",                   label: "Todos os módulos" },
  { value: "drps",               label: "DRPS — Psicossocial" },
  { value: "aet",                label: "AET — Análise Ergonômica" },
  { value: "aep",                label: "AEP — Análise Ergonômica Preliminar" },
  { value: "sst",                label: "SST — Inspeções" },
  { value: "conformidade",       label: "Conformidade" },
  { value: "nao_conformidade",   label: "Não Conformidade" },
  { value: "analise_quimicos",   label: "Análise de Químicos" },
  { value: "apreciacao_maquinas",label: "Apreciação NR-12" },
];

const MODULO_LABEL: Record<string, string> = Object.fromEntries(
  MODULOS.filter((m) => m.value).map((m) => [m.value, m.label])
);

const MODULO_COLOR: Record<string, string> = {
  drps:                "bg-purple-100 text-purple-700",
  aet:                 "bg-orange-100 text-orange-700",
  aep:                 "bg-yellow-100 text-yellow-700",
  sst:                 "bg-verde-light text-verde-primary",
  conformidade:        "bg-blue-100 text-blue-700",
  nao_conformidade:    "bg-red-100 text-red-700",
  analise_quimicos:    "bg-cyan-100 text-cyan-700",
  apreciacao_maquinas: "bg-gray-100 text-gray-700",
};

export default function PdfsGeradosTab() {
  const [moduloFiltro, setModuloFiltro] = useState("");
  const { data: pdfs = [], isLoading, refetch, isFetching } = usePdfsGerados(
    moduloFiltro ? { modulo: moduloFiltro } : undefined
  );

  const total   = pdfs.length;
  const assinados = pdfs.filter((p) => p.assinado).length;

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-gray-600">
            Histórico de todos os PDFs gerados pelo sistema. O arquivo é salvo
            automaticamente no storage após cada geração.
          </p>
          {!isLoading && (
            <p className="mt-1 text-xs text-gray-400">
              {total} PDF{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}
              {assinados > 0 && <> · {assinados} assinado{assinados !== 1 ? "s" : ""}</>}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Filtro de módulo */}
          <div className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2 py-1.5">
            <Filter className="size-3.5 text-gray-400" />
            <select
              value={moduloFiltro}
              onChange={(e) => setModuloFiltro(e.target.value)}
              className="border-none bg-transparent text-sm text-gray-700 focus:outline-none"
            >
              {MODULOS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : pdfs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
          <FileText className="mx-auto mb-2 size-8 text-gray-300" />
          <p className="text-sm text-gray-500">Nenhum PDF gerado ainda.</p>
          <p className="mt-1 text-xs text-gray-400">
            PDFs serão registrados automaticamente ao clicar em{" "}
            <strong>Gerar PDF</strong> nos relatórios.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-2.5">Módulo</th>
                <th className="px-4 py-2.5">Empresa</th>
                <th className="px-4 py-2.5">Responsável</th>
                <th className="px-4 py-2.5">Data</th>
                <th className="px-4 py-2.5">Versão</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pdfs.map((pdf) => (
                <PdfRow key={pdf.id} pdf={pdf} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PdfRow({ pdf }: { pdf: import("@/lib/hooks/usePdfsGerados").PdfGerado }) {
  const dataFormatada = new Date(pdf.data_geracao).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const moduloLabel = MODULO_LABEL[pdf.modulo] ?? pdf.modulo;
  const corModulo   = MODULO_COLOR[pdf.modulo] ?? "bg-gray-100 text-gray-700";
  const urlParaBaixar = pdf.pdf_assinado_url ?? pdf.pdf_url;

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <span className={cn("inline-block rounded px-2 py-0.5 text-[11px] font-bold", corModulo)}>
          {moduloLabel}
        </span>
        {pdf.tipo_documento && (
          <p className="mt-0.5 text-[11px] text-gray-400">{pdf.tipo_documento}</p>
        )}
      </td>

      <td className="px-4 py-3">
        {pdf.empresa_nome ? (
          <>
            <p className="font-medium text-gray-800">{pdf.empresa_nome}</p>
            {pdf.empresa_cnpj && (
              <p className="text-[11px] text-gray-400">{pdf.empresa_cnpj}</p>
            )}
          </>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>

      <td className="px-4 py-3 text-gray-700">
        {pdf.responsavel_tecnico ?? <span className="text-gray-400">—</span>}
      </td>

      <td className="px-4 py-3 text-gray-700 tabular-nums">{dataFormatada}</td>

      <td className="px-4 py-3 text-center font-mono text-xs text-gray-500">
        v{pdf.versao}
      </td>

      <td className="px-4 py-3">
        {pdf.assinado ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
            <BadgeCheck className="size-3" /> Assinado
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
            Gerado
          </span>
        )}
      </td>

      <td className="px-4 py-3 text-right">
        {urlParaBaixar ? (
          <a
            href={urlParaBaixar}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="size-3.5" /> Baixar
          </a>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
    </tr>
  );
}
