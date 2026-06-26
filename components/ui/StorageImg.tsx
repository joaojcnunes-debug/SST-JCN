"use client";

import { useSignedUrl } from "@/lib/hooks/useSignedUrl";
import { extrairPathStorage } from "@/lib/storage/signed-url";

/**
 * <img> que resolve mídia do Storage para telas AUTENTICADAS:
 * - valor do bucket (path ou URL pública/assinada) → URL assinada (com fallback
 *   para o valor atual enquanto carrega; o bucket ainda é público);
 * - blob:/data:/URL de outra origem → renderiza direto (preview de upload, etc.).
 * NÃO usar em templates de PDF (Puppeteer não autentica; o servidor injeta a URL
 * assinada nas rotas de PDF — fase F2b).
 */
export default function StorageImg({
  stored,
  bucket = "fotos",
  alt = "",
  className,
  fallback = null,
}: {
  stored: string | null | undefined;
  bucket?: string;
  alt?: string;
  className?: string;
  fallback?: React.ReactNode;
}) {
  const path = extrairPathStorage(stored, bucket);
  const { data: assinada } = useSignedUrl(stored, bucket); // desabilitado se não houver path

  if (!stored) return <>{fallback}</>;

  // path do bucket → assinada (fallback p/ o stored enquanto carrega); senão, direto.
  const src = path ? (assinada ?? stored) : stored;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} referrerPolicy="no-referrer" />;
}
