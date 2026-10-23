"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { corAvatar, iniciais, useFotoDe } from "@/lib/hooks/useGestao";

/**
 * Avatar da pessoa na Gestão (v302): a foto da conta Google quando ela conectou o Google Agenda;
 * senão (ou se a imagem não carregar) as iniciais na cor do nome, como antes.
 * `className` traz tamanho/fonte/anel de quem usa — vale para a foto e para as iniciais.
 */
export default function AvatarPessoa({
  nome,
  email,
  className,
  title,
  ariaLabel,
  fallback,
}: {
  nome: string;
  email?: string | null;
  className?: string;
  title?: string;
  ariaLabel?: string;
  /** Sem foto: mostra isto no lugar das iniciais coloridas (ex.: o estilo próprio da barra superior). */
  fallback?: React.ReactNode;
}) {
  const foto = useFotoDe(nome, email);
  const [falhou, setFalhou] = useState<string | null>(null);

  if (foto && falhou !== foto) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- foto externa pequena; next/image exigiria liberar o domínio do Google
      <img
        src={foto}
        alt=""
        title={title}
        aria-label={ariaLabel}
        referrerPolicy="no-referrer"
        onError={() => setFalhou(foto)}
        className={cn("shrink-0 rounded-full bg-gray-100 object-cover", className)}
      />
    );
  }
  if (fallback) return <>{fallback}</>;
  return (
    <span
      title={title}
      aria-label={ariaLabel}
      className={cn("flex shrink-0 items-center justify-center rounded-full font-bold text-white", className)}
      style={{ background: corAvatar(nome) }}
    >
      {iniciais(nome)}
    </span>
  );
}
