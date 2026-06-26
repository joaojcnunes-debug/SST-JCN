"use client";

import { useRef, useState } from "react";
import {
  Paperclip,
  Upload,
  Trash2,
  Loader2,
  FileText,
  ImageIcon,
  File as FileIcon,
  Eye,
  EyeOff,
  ExternalLink,
  Star,
  AlertTriangle,
} from "lucide-react";
import {
  useAnexos,
  useEnviarAnexo,
  useAtualizarAnexo,
  useExcluirAnexo,
} from "@/lib/hooks/useAnexos";
import { VINCULOS_ANEXO, type Anexo, type ModuloAnexo, type TipoAnexo } from "@/lib/anexos/types";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { abrirMidiaAssinada } from "@/lib/storage/abrir-midia-assinada";
import { cn } from "@/lib/utils";

interface Props {
  modulo: ModuloAnexo;
  idReferencia: string;
}

function iconePorTipo(tipo: TipoAnexo) {
  if (tipo === "pdf") return <FileText className="size-4 text-red-600" />;
  if (tipo === "imagem") return <ImageIcon className="size-4 text-sky-600" />;
  return <FileIcon className="size-4 text-gray-500" />;
}

function tamanhoLegivel(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Gerencia os anexos de um laudo (upload, descrição, incluir no PDF, remover).
 * Os anexos marcados com "incluir no PDF" são mesclados ao laudo gerado:
 * PDFs como páginas reais, imagens como páginas inteiras.
 */
export default function AnexosManager({ modulo, idReferencia }: Props) {
  const { data: anexos = [], isLoading } = useAnexos(modulo, idReferencia);
  const enviar = useEnviarAnexo(modulo, idReferencia);
  const atualizar = useAtualizarAnexo(modulo, idReferencia);
  const excluir = useExcluirAnexo(modulo, idReferencia);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [confirmar, setConfirmar] = useState<Anexo | null>(null);

  function onArquivos(files: FileList | null) {
    if (!files) return;
    let ordem = anexos.length;
    for (const file of Array.from(files)) {
      enviar.mutate({ file, ordem });
      ordem++;
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  const incluidos = anexos.filter((a) => a.incluir_no_pdf).length;

  return (
    <div className="print:hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Paperclip className="size-4 text-verde-primary" />
          <h3 className="text-sm font-semibold text-gray-900">Anexos</h3>
          {anexos.length > 0 && (
            <span className="text-xs text-gray-500">
              {anexos.length} arquivo{anexos.length !== 1 ? "s" : ""} · {incluidos} no PDF
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={enviar.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-3 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
        >
          {enviar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Enviar anexo
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => onArquivos(e.target.files)}
        />
      </div>

      <p className="mb-3 text-xs text-gray-500">
        PDFs entram como páginas reais no laudo; imagens como páginas inteiras. Outros
        formatos aparecem apenas no índice de anexos.
      </p>

      {isLoading ? (
        <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
      ) : anexos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 py-6 text-center text-sm text-gray-500">
          Nenhum anexo. Envie ARTs, certificados, plantas ou fotos complementares.
        </p>
      ) : (
        <ul className="space-y-2">
          {anexos.map((a) => (
            <li
              key={a.id_anexo}
              className={cn(
                "rounded-lg border p-2.5",
                a.incluir_no_pdf ? "border-gray-200 bg-white" : "border-gray-200 bg-gray-50 opacity-70",
              )}
            >
            <div className="flex flex-wrap items-center gap-2">
              <span className="shrink-0">{iconePorTipo(a.tipo)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-800">{a.nome}</p>
                <input
                  type="text"
                  defaultValue={a.descricao ?? ""}
                  placeholder="Descrição (aparece no índice de anexos)…"
                  onBlur={(e) => {
                    const v = e.target.value.trim() || null;
                    if (v !== (a.descricao ?? null)) {
                      atualizar.mutate({ id_anexo: a.id_anexo, descricao: v });
                    }
                  }}
                  className="mt-0.5 w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-gray-600 hover:border-gray-200 focus:border-verde-primary focus:bg-white focus:outline-none"
                />
              </div>
              <span className="shrink-0 text-[10px] text-gray-400">{tamanhoLegivel(a.tamanho_bytes)}</span>
              <button
                type="button"
                onClick={() => abrirMidiaAssinada(a.url, "anexos")}
                className="shrink-0 rounded-md border border-gray-300 bg-white p-1.5 text-gray-500 hover:bg-gray-50"
                title="Abrir"
              >
                <ExternalLink className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => atualizar.mutate({ id_anexo: a.id_anexo, incluir_no_pdf: !a.incluir_no_pdf })}
                title={a.incluir_no_pdf ? "Incluído no PDF — clique para remover" : "Fora do PDF — clique para incluir"}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1.5 text-[11px] font-semibold transition-colors",
                  a.incluir_no_pdf
                    ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
                    : "border-gray-300 bg-white text-gray-500 hover:bg-gray-50",
                )}
              >
                {a.incluir_no_pdf ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                PDF
              </button>
              <button
                type="button"
                onClick={() => setConfirmar(a)}
                className="shrink-0 rounded-md border border-gray-300 bg-white p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-alert"
                title="Remover"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>

            {/* Controles E2: vínculo técnico, validade, obrigatório */}
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-dashed border-gray-200 pt-2 text-[11px]">
              <label className="flex items-center gap-1 text-gray-500">
                Vínculo:
                <select
                  defaultValue={a.vinculo_tipo ?? ""}
                  onChange={(e) =>
                    atualizar.mutate({ id_anexo: a.id_anexo, vinculo_tipo: e.target.value || null })
                  }
                  className="rounded border border-gray-300 bg-white px-1 py-0.5 text-[11px] text-gray-700 focus:border-verde-primary focus:outline-none"
                >
                  <option value="">—</option>
                  {VINCULOS_ANEXO.map((v) => (
                    <option key={v.value} value={v.value}>{v.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1 text-gray-500">
                Validade:
                <input
                  type="date"
                  defaultValue={a.validade ?? ""}
                  onChange={(e) =>
                    atualizar.mutate({ id_anexo: a.id_anexo, validade: e.target.value || null })
                  }
                  className="rounded border border-gray-300 bg-white px-1 py-0.5 text-[11px] text-gray-700 focus:border-verde-primary focus:outline-none"
                />
              </label>
              <button
                type="button"
                onClick={() => atualizar.mutate({ id_anexo: a.id_anexo, obrigatorio: !a.obrigatorio })}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-semibold transition-colors",
                  a.obrigatorio
                    ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                    : "border-gray-300 bg-white text-gray-500 hover:bg-gray-50",
                )}
                title="Marcar como anexo obrigatório"
              >
                {a.obrigatorio ? <Star className="size-3 fill-amber-500 text-amber-500" /> : <Star className="size-3" />}
                Obrigatório
              </button>
              {a.obrigatorio && !a.incluir_no_pdf && (
                <span className="inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 font-semibold text-red-alert">
                  <AlertTriangle className="size-3" /> obrigatório fora do PDF
                </span>
              )}
            </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!confirmar}
        title="Remover anexo?"
        description={confirmar ? `"${confirmar.nome}" será removido permanentemente.` : undefined}
        variant="danger"
        loading={excluir.isPending}
        onConfirm={() => {
          if (!confirmar) return;
          excluir.mutate(confirmar, { onSuccess: () => setConfirmar(null) });
        }}
        onCancel={() => setConfirmar(null)}
      />
    </div>
  );
}
