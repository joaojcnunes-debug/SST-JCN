"use client";

import { useState } from "react";
import { Share2, Loader2, X } from "lucide-react";
import { useLiberarDocumento } from "@/lib/hooks/useDocumentosCliente";
import { useCurrentUser } from "@/lib/hooks/useUsuario";
import type { TipoDocumentoPortal } from "@/lib/supabase/types";

const TIPOS: TipoDocumentoPortal[] = [
  "AET", "AEP", "RNC", "Conformidade", "DRPS", "NR-12", "Quimicos", "Inspecao", "Outro",
];

interface Props {
  empresaId: string;
  /** Título pré-preenchido (ex: nome do relatório) */
  titulo?: string;
  tipoDocumento?: TipoDocumentoPortal;
  moduloOrigem?: string;
  arquivoPdfUrl?: string;
  dataEmissao?: string;
  referenciaTipo?: string;
  referenciaId?: string;
  /** Tamanho do botão */
  size?: "sm" | "md";
}

export default function LiberarParaPortalBtn({
  empresaId,
  titulo: tituloProp = "",
  tipoDocumento: tipoProp = "Outro",
  moduloOrigem: moduloProp = "",
  arquivoPdfUrl: urlProp = "",
  dataEmissao: emissaoProp = "",
  referenciaTipo,
  referenciaId,
  size = "sm",
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState(tituloProp);
  const [tipo, setTipo] = useState<TipoDocumentoPortal>(tipoProp);
  const [modulo] = useState(moduloProp);
  const [pdfUrl, setPdfUrl] = useState(urlProp);
  const [emissao, setEmissao] = useState(emissaoProp);
  const [validade, setValidade] = useState("");
  const liberar = useLiberarDocumento();
  const user = useCurrentUser();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await liberar.mutateAsync({
      empresa_id: empresaId,
      titulo: titulo.trim(),
      tipo_documento: tipo,
      modulo_origem: modulo.trim() || tipo,
      arquivo_pdf_url: pdfUrl.trim() || undefined,
      data_emissao: emissao || undefined,
      data_validade: validade || undefined,
      criado_por: user?.id_usuario ?? undefined,
      referencia_tipo: referenciaTipo,
      referencia_id: referenciaId,
    });
    setAberto(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={`flex items-center gap-1.5 rounded-lg bg-teal-700 font-medium text-white hover:bg-teal-800 transition-colors ${
          size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"
        }`}
        title="Liberar para o Portal do Cliente"
      >
        <Share2 className={size === "sm" ? "size-3.5" : "size-4"} />
        Liberar para Portal
      </button>

      {/* Modal */}
      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-semibold text-gray-900">Liberar documento para o Portal</h2>
              <button type="button" onClick={() => setAberto(false)}>
                <X className="size-5 text-gray-500 hover:text-gray-700" />
              </button>
            </div>
            <form onSubmit={submit} className="space-y-4 px-5 py-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Título *</label>
                <input
                  required
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Tipo *</label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as TipoDocumentoPortal)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Data de emissão</label>
                  <input
                    type="date"
                    value={emissao}
                    onChange={(e) => setEmissao(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">URL do PDF (opcional)</label>
                <input
                  type="url"
                  value={pdfUrl}
                  onChange={(e) => setPdfUrl(e.target.value)}
                  placeholder="https://…"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Data de validade (opcional)</label>
                <input
                  type="date"
                  value={validade}
                  onChange={(e) => setValidade(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={liberar.isPending}
                  className="flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
                >
                  {liberar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
                  Liberar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
