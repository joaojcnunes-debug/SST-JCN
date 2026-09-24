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
  loading,
  width,
  height,
}: {
  stored: string | null | undefined;
  bucket?: string;
  alt?: string;
  className?: string;
  fallback?: React.ReactNode;
  /**
   * `"lazy"` só baixa a imagem quando ela chega perto da viewport. OPCIONAL de
   * propósito: sem este parâmetro o componente se comporta exatamente como
   * sempre se comportou, e as ~30 telas que já o usam não mudam em nada.
   * Ligado hoje só na listagem do inventário, onde há dezenas de imagens fora
   * da tela sendo baixadas à toa.
   */
  loading?: "lazy" | "eager";
  /** Dimensão intrínseca, em px. Serve para o navegador reservar o espaço antes
   *  de a imagem chegar e não empurrar o layout (reflow) quando ela chega. */
  width?: number;
  height?: number;
}) {
  const path = extrairPathStorage(stored, bucket);
  const { data: assinada } = useSignedUrl(stored, bucket); // desabilitado se não houver path

  if (!stored) return <>{fallback}</>;

  // path do bucket → assinada (fallback p/ o stored enquanto carrega); senão, direto.
  const src = path ? (assinada ?? stored) : stored;
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      loading={loading}
      width={width}
      height={height}
    />
  );
}
