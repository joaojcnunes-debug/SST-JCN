"use client";

import { useState } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { extrairPathStorage } from "@/lib/storage/signed-url";
import { useDocumentosCliente } from "@/lib/hooks/useDocumentosCliente";
import { StatusDocBadge } from "./StatusBadgeCliente";
import type { StatusDocumentoPortal } from "@/lib/supabase/types";

const FILTROS: { label: string; value: StatusDocumentoPortal | "todos" }[] = [
  { label: "Todos", value: "todos" },
  { label: "Liberados", value: "liberado" },
  { label: "Assinados", value: "assinado" },
  { label: "Vencidos", value: "vencido" },
];

async function baixarPdf(url: string) {
  // Resolve via URL assinada quando o valor aponta para um bucket (path puro OU
  // URL pública/assinada legada). Se for URL externa, abre direto. Sem o
  // extrairPathStorage, uma URL pública de bucket (http) era aberta direto e
  // quebraria ao privatizar o bucket.
  const bucket = url.includes("portal-anexos") ? "portal-anexos" : "fotos";
  const path = extrairPathStorage(url, bucket);
  if (!path) {
    window.open(url, "_blank");
    return;
  }
  const sb = createSupabaseBrowserClient();
  const { data } = await sb.storage.from(bucket).createSignedUrl(path, 120);
  if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  else toast.error("Não foi possível abrir o arquivo.");
}

export default function DocumentosCliente() {
  const [filtro, setFiltro] = useState<StatusDocumentoPortal | "todos">("todos");
  const { data: docs, isLoading, error } = useDocumentosCliente(filtro);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Documentos</h1>
        <p className="mt-1 text-sm text-gray-500">Documentos técnicos disponibilizados para sua empresa</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFiltro(f.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filtro === f.value
                ? "bg-teal-700 text-white"
                : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          Erro ao carregar documentos. Tente novamente.
        </p>
      )}

      {!isLoading && !error && docs?.length === 0 && (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
          <FileText className="mx-auto size-10 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-500">Nenhum documento encontrado</p>
        </div>
      )}

      {!isLoading && docs && docs.length > 0 && (
        <div className="space-y-3">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-start gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-teal-50">
                <FileText className="size-5 text-teal-700" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-gray-900">{doc.titulo}</p>
                  <StatusDocBadge status={doc.status} />
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {doc.tipo_documento}
                  </span>
                  {doc.versao > 1 && (
                    <span className="text-xs text-gray-400">v{doc.versao}</span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  {doc.data_emissao ? `Emissão: ${doc.data_emissao}` : null}
                  {doc.data_validade ? ` · Validade: ${doc.data_validade}` : null}
                </p>
              </div>
              {doc.arquivo_pdf_url && (
                <button
                  type="button"
                  onClick={() => baixarPdf(doc.arquivo_pdf_url!)}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
                >
                  <Download className="size-4" />
                  <span className="hidden sm:inline">Baixar</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
