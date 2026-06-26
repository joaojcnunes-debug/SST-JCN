"use client";

import type { CSSProperties, ReactNode } from "react";
import { useSignedUrl } from "@/lib/hooks/useSignedUrl";
import { extrairPathStorage } from "@/lib/storage/signed-url";

/**
 * <div> com `background-image` resolvido do Storage (capas que usam CSS bg, não
 * <img>). Telas autenticadas: valor do bucket → URL assinada (fallback p/ o
 * valor atual enquanto carrega; bucket ainda público). blob:/data:/origem
 * externa entram direto. Para captura de DOM (Electron print / html-to-image).
 */
export default function StorageBg({
  stored,
  bucket = "fotos",
  className,
  style,
  children,
}: {
  stored: string | null | undefined;
  bucket?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const path = extrairPathStorage(stored, bucket);
  const { data: assinada } = useSignedUrl(stored, bucket);
  const url = !stored ? null : path ? (assinada ?? stored) : stored;

  return (
    <div
      className={className}
      style={{ ...style, ...(url ? { backgroundImage: `url(${url})` } : {}) }}
    >
      {children}
    </div>
  );
}
