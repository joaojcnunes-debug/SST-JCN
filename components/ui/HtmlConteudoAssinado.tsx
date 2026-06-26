"use client";

import { useHtmlImagensAssinadas } from "@/lib/hooks/useSignedUrl";

/**
 * `<div>` com HTML rich-text (salvo pelo RichTextEditor) cujas imagens inline
 * (`<img src=...>`) são resolvidas para URLs ASSINADAS — para as PRÉVIAS na tela
 * (autenticadas). É o análogo client do `assinarImagensHtml` do servidor.
 * Fallback-seguro: enquanto a assinatura não resolve usa o valor original e
 * origens externas ficam intactas. NÃO usar em templates de PDF.
 */
export default function HtmlConteudoAssinado({
  html,
  className,
  style,
  bucket = "fotos",
}: {
  html: string;
  className?: string;
  style?: React.CSSProperties;
  bucket?: string;
}) {
  const assinado = useHtmlImagensAssinadas(html, bucket);
  return (
    <div
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: assinado }}
    />
  );
}
