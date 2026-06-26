"use client";

import { useRef, useState } from "react";
import { Upload, Trash2, FileText, Image as ImageIcon, File as FileIcon } from "lucide-react";
import toast from "react-hot-toast";
import { useAnexos, useUploadAnexo, useExcluirAnexo, urlAssinadaAnexo, type GestaoAnexo } from "@/lib/hooks/useGestao";
import { confirmar } from "@/components/ui/confirm";

const MAX = 25 * 1024 * 1024; // 25 MB

function fmtBytes(n: number | null): string {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

function IconeAnexo({ mime }: { mime: string | null }) {
  if (mime?.startsWith("image/")) return <ImageIcon className="size-4 text-verde-primary" />;
  if (mime === "application/pdf") return <FileText className="size-4 text-red-500" />;
  return <FileIcon className="size-4 text-gray-400" />;
}

export default function AnexosTarefa({ idTarefa, podeEditar }: { idTarefa: string; podeEditar: boolean }) {
  const { data: anexos = [], isLoading } = useAnexos(idTarefa);
  const upload = useUploadAnexo();
  const excluir = useExcluirAnexo();
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setEnviando(true);
    for (const file of Array.from(files)) {
      if (file.size > MAX) { toast.error(`"${file.name}" excede 25 MB.`); continue; }
      await upload.mutateAsync({ id_tarefa: idTarefa, file }).catch(() => {});
    }
    setEnviando(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function abrir(path: string) {
    const url = await urlAssinadaAnexo(path);
    if (url) window.open(url, "_blank", "noopener");
    else toast.error("Não foi possível abrir o anexo.");
  }

  async function remover(a: GestaoAnexo) {
    if (await confirmar({ title: "Excluir anexo?", description: a.nome })) excluir.mutate({ id: a.id, storage_path: a.storage_path });
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Anexos {anexos.length > 0 && `(${anexos.length})`}</span>
        {podeEditar && (
          <>
            <button type="button" onClick={() => inputRef.current?.click()} disabled={enviando} className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
              <Upload className="size-3.5" /> {enviando ? "Enviando…" : "Enviar arquivo"}
            </button>
            <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
          </>
        )}
      </div>

      {isLoading ? (
        <p className="text-xs text-gray-400">Carregando…</p>
      ) : anexos.length === 0 ? (
        <p className="text-xs text-gray-400">Nenhum anexo. {podeEditar && "Envie arquivos relacionados a esta tarefa (até 25 MB)."}</p>
      ) : (
        <ul className="space-y-1">
          {anexos.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-md border border-gray-100 bg-gray-50/60 px-2 py-1.5">
              <IconeAnexo mime={a.mime} />
              <button type="button" onClick={() => abrir(a.storage_path)} className="flex-1 truncate text-left text-sm text-gray-700 hover:text-verde-primary hover:underline" title={a.nome}>
                {a.nome}
              </button>
              <span className="shrink-0 text-[11px] text-gray-400">{fmtBytes(a.tamanho_bytes)}</span>
              {podeEditar && (
                <button type="button" onClick={() => remover(a)} title="Excluir anexo" className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500">
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
