"use client";

import { useMemo } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { extrairPathStorage } from "@/lib/storage/signed-url";

const TTL = 3600; // 1h

async function assinar(bucket: string, path: string): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, TTL);
  if (error || !data?.signedUrl) throw error ?? new Error("Falha ao assinar URL");
  return data.signedUrl;
}

/**
 * Resolve um valor armazenado (path ou URL legada) numa URL assinada de curta
 * duração. Cacheado por (bucket, path). Mantém-se válido enquanto o bucket é
 * público e continua funcionando quando privatizar.
 */
export function useSignedUrl(stored: string | null | undefined, bucket = "fotos") {
  const path = extrairPathStorage(stored, bucket);
  return useQuery({
    queryKey: ["signed-url", bucket, path],
    enabled: !!path,
    staleTime: (TTL - 300) * 1000,
    gcTime: TTL * 1000,
    retry: 1,
    meta: { silent: true },
    queryFn: () => assinar(bucket, path!),
  });
}

/** Versão em lote (galerias: arrays de fotos). Mantém a ordem dos itens. */
export function useSignedUrls(stored: (string | null | undefined)[], bucket = "fotos") {
  const paths = stored.map((s) => extrairPathStorage(s, bucket));
  return useQueries({
    queries: paths.map((path) => ({
      queryKey: ["signed-url", bucket, path],
      enabled: !!path,
      staleTime: (TTL - 300) * 1000,
      gcTime: TTL * 1000,
      retry: 1,
      meta: { silent: true },
      queryFn: () => assinar(bucket, path!),
    })),
  });
}

const IMG_SRC_RE = /<img\b[^>]*?\bsrc\s*=\s*(["'])(.*?)\1/gi;

/**
 * Reescreve as imagens inline (`<img src=...>`) de uma string HTML salva (rich
 * text), trocando cada src do bucket por URL assinada. É o análogo CLIENT do
 * `assinarImagensHtml` do servidor — para as PRÉVIAS na tela (autenticadas).
 * Fallback-seguro: src de origem externa fica intacta e, enquanto a assinatura
 * não resolve, usa o valor original (o bucket ainda é público).
 */
export function useHtmlImagensAssinadas(
  html: string | null | undefined,
  bucket = "fotos",
): string {
  // Extrai as srcs únicas (ordem estável para os hooks de assinatura).
  const srcs = useMemo(() => {
    if (!html) return [] as string[];
    const set = new Set<string>();
    const re = new RegExp(IMG_SRC_RE.source, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) set.add(m[2]);
    return [...set];
  }, [html]);

  const resultados = useSignedUrls(srcs, bucket);

  if (!html || srcs.length === 0) return html ?? "";

  const mapa = new Map<string, string>();
  srcs.forEach((src, i) => {
    const assinada = resultados[i]?.data;
    if (assinada) mapa.set(src, assinada);
  });
  if (mapa.size === 0) return html;

  const re = new RegExp(IMG_SRC_RE.source, "gi");
  return html.replace(re, (full, _quote: string, src: string) => {
    const assinada = mapa.get(src);
    return assinada ? full.replace(src, assinada) : full;
  });
}
