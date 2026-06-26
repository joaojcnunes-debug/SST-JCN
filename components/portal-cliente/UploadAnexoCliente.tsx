"use client";

import { useRef, useState } from "react";
import { Paperclip, Loader2, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/hooks/useUsuario";
import type { ReferenciaPortalTipo } from "@/lib/supabase/types";

interface Props {
  empresaId: string;
  referenciaId: string;
  referenciaTipo: ReferenciaPortalTipo;
  onUploaded?: () => void;
}

export default function UploadAnexoCliente({ empresaId, referenciaId, referenciaTipo, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const user = useCurrentUser();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setEnviando(true);
    try {
      const sb = createSupabaseBrowserClient();
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${empresaId}/${referenciaTipo}/${referenciaId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await sb.storage
        .from("portal-anexos")
        .upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: dbError } = await (sb as any).from("portal_anexos").insert({
        empresa_id: empresaId,
        referencia_tipo: referenciaTipo,
        referencia_id: referenciaId,
        nome_arquivo: file.name,
        storage_path: path,
        tamanho_bytes: file.size,
        mime_type: file.type || null,
        criado_por: user?.id_usuario ?? null,
      });
      if (dbError) throw dbError;

      toast.success("Arquivo enviado.");
      onUploaded?.();
    } catch {
      toast.error("Erro ao enviar arquivo.");
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.txt"
        onChange={handleFile}
      />
      <button
        type="button"
        disabled={enviando}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
      >
        {enviando ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Paperclip className="size-4" />
        )}
        {enviando ? "Enviando…" : "Anexar arquivo"}
      </button>
    </div>
  );
}

export function AnexoItem({
  nome,
  storagePath,
  bucket = "portal-anexos",
}: {
  nome: string;
  storagePath: string;
  bucket?: string;
}) {
  async function baixar() {
    const sb = createSupabaseBrowserClient();
    const { data } = await sb.storage.from(bucket).createSignedUrl(storagePath, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Não foi possível obter o link do arquivo.");
  }

  return (
    <button
      type="button"
      onClick={baixar}
      className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
    >
      <CheckCircle2 className="size-4 shrink-0 text-green-600" />
      <span className="truncate max-w-[220px]">{nome}</span>
    </button>
  );
}
