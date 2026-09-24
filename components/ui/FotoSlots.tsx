"use client";

import { useRef } from "react";
import { ImagePlus, X } from "lucide-react";
import { useSignedUrls } from "@/lib/hooks/useSignedUrl";

export type FotoSlot =
  | { type: "existing"; url: string; path: string }
  | { type: "new"; file: File; preview: string };

interface Props {
  slots: (FotoSlot | null)[];
  onChange: (slots: (FotoSlot | null)[]) => void;
  max?: number;
  disabled?: boolean;
  /** Bucket das fotos existentes (default "fotos"). */
  bucket?: string;
}

export default function FotoSlots({ slots, onChange, max = 4, disabled, bucket = "fotos" }: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function onFileChange(idx: number, e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const preview = URL.createObjectURL(f);
    const next = [...slots];
    next[idx] = { type: "new", file: f, preview };
    onChange(next);
    // reset so same file can be re-selected
    e.target.value = "";
  }

  function remove(idx: number) {
    const next = [...slots];
    next[idx] = null;
    onChange(next);
  }

  const allSlots = Array.from({ length: max }, (_, i) => slots[i] ?? null);

  // Resolve fotos existentes via URL assinada (a partir do path; fallback p/ a
  // URL armazenada enquanto carrega — e porque o bucket ainda é público).
  const existentes = allSlots.map((s) => (s?.type === "existing" ? s.path || s.url : null));
  const assinadas = useSignedUrls(existentes, bucket);

  return (
    <div className="flex flex-wrap gap-2">
      {allSlots.map((slot, i) => {
        const urlExistente = slot?.type === "existing" ? (assinadas[i]?.data ?? slot.url) : null;
        const url =
          slot?.type === "existing"
            ? urlExistente
            : slot?.type === "new"
            ? slot.preview
            : null;
        const href = slot?.type === "existing" ? urlExistente : null;

        return (
          <div key={i} className="relative shrink-0">
            {url ? (
              <>
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Foto ${i + 1}`}
                      className="h-20 w-20 rounded-lg border border-gray-200 object-cover hover:opacity-80"
                    />
                  </a>
                ) : (
                  // new file: preview only (blob URL, can't open externally yet)
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={`Foto ${i + 1}`}
                    className="h-20 w-20 rounded-lg border border-gray-200 object-cover"
                  />
                )}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white shadow hover:bg-red-700"
                    title="Remover foto"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </>
            ) : disabled ? (
              <div className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 text-gray-300">
                <ImagePlus className="size-5" />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => refs.current[i]?.click()}
                className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 text-gray-400 hover:border-verde-primary hover:bg-verde-light hover:text-verde-primary"
                title="Adicionar foto"
              >
                <ImagePlus className="size-5" />
              </button>
            )}
            <input
              ref={(el) => { refs.current[i] = el; }}
              type="file"
              accept="image/*"
              onChange={(e) => onFileChange(i, e)}
              className="hidden"
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Versão offline-capaz do `uploadFotoSlots`: DECIDE os caminhos e monta as URLs,
 * mas não sobe nada e não apaga nada.
 *
 * Existe ao lado do original, e não no lugar dele, porque `uploadFotoSlots` é
 * usado também por Inventário de Máquinas e Equipamentos — módulos que ainda não
 * entraram no offline. Trocar a assinatura dele arrastaria os dois para dentro
 * deste trabalho sem necessidade.
 *
 * É SÍNCRONA de propósito: `getPublicUrl` monta string a partir do host do
 * storage, sem ir à rede. É isso que permite gravar a linha da foto offline já
 * apontando para o lugar onde o arquivo vai estar quando a fila subir.
 *
 * `paraRemover` sai daqui em vez de ser apagado: sem rede não há como apagar, e
 * quem chama decide. Arquivo órfão no MinIO é desperdício de espaço, não erro —
 * a mesma postura que a galeria da Frota já adota.
 */
export function prepararFotoSlots(
  supabase: ReturnType<typeof import("@/lib/supabase/client").createSupabaseBrowserClient>,
  slots: (FotoSlot | null)[],
  oldPaths: string[],
  bucket: string,
  basePath: string,
  gerarId: (prefix: string) => string,
): {
  urls: string[];
  paths: string[];
  imagens: { blob: Blob; caminho: string }[];
  paraRemover: string[];
} {
  const mantidos = new Set(
    slots
      .filter((s): s is Extract<FotoSlot, { type: "existing" }> => s?.type === "existing")
      .map((s) => s.path),
  );

  const urls: string[] = [];
  const paths: string[] = [];
  const imagens: { blob: Blob; caminho: string }[] = [];

  for (const s of slots) {
    if (!s) continue;
    if (s.type === "existing") {
      urls.push(s.url);
      paths.push(s.path);
      continue;
    }
    const ext = s.file.name.split(".").pop() ?? "jpg";
    const caminho = `${basePath}/${gerarId("IMG")}.${ext}`;
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(caminho);
    urls.push(pub.publicUrl);
    paths.push(caminho);
    imagens.push({ blob: s.file, caminho });
  }

  return { urls, paths, imagens, paraRemover: oldPaths.filter((p) => !mantidos.has(p)) };
}

/** Faz upload dos slots novos, deleta os removidos e retorna urls/paths finais. */
export async function uploadFotoSlots(
  supabase: ReturnType<typeof import("@/lib/supabase/client").createSupabaseBrowserClient>,
  slots: (FotoSlot | null)[],
  oldPaths: string[],
  bucket: string,
  basePath: string,
  gerarId: (prefix: string) => string,
): Promise<{ urls: string[]; paths: string[] }> {
  // Paths que ainda existem no estado final
  const keptPaths = new Set(
    slots
      .filter((s): s is Extract<FotoSlot, { type: "existing" }> => s?.type === "existing")
      .map((s) => s.path),
  );
  const toDelete = oldPaths.filter((p) => !keptPaths.has(p));
  if (toDelete.length) {
    await supabase.storage.from(bucket).remove(toDelete);
  }

  const resultUrls: string[] = [];
  const resultPaths: string[] = [];

  for (const s of slots) {
    if (!s) continue;
    if (s.type === "existing") {
      resultUrls.push(s.url);
      resultPaths.push(s.path);
    } else {
      const ext = s.file.name.split(".").pop() ?? "jpg";
      const path = `${basePath}/${gerarId("IMG")}.${ext}`;
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, s.file, { upsert: false });
      if (error) throw error;
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
      resultUrls.push(pub.publicUrl);
      resultPaths.push(path);
    }
  }

  return { urls: resultUrls, paths: resultPaths };
}
