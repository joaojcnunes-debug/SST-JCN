"use client";

// Uma pessoa com a foto (ou as iniciais) antes do nome (0.3.306, 19/11/2026 — pedido do João: o formato de pessoas da
// Gestão no sistema todo). Para lugares de UMA pessoa onde o nome cabe e ajuda (blocos de cartão, colunas de quem fez),
// e para dentro de links (não abre caixinha). Várias pessoas em linha de tabela: AlocadosCompactos.

import AvatarPessoa from "@/components/gestao/AvatarPessoa";
import { cn } from "@/lib/utils";

export default function PessoaComFoto({
  nome,
  email,
  vazio = "—",
  className,
  tamanho = "size-6 text-[9px]",
}: {
  nome: string | null | undefined;
  email?: string | null;
  /** O que mostrar sem nome. */
  vazio?: React.ReactNode;
  className?: string;
  /** Classes de tamanho/fonte do círculo. */
  tamanho?: string;
}) {
  const n = (nome ?? "").trim();
  if (!n) return <>{vazio}</>;
  return (
    <span className={cn("inline-flex min-w-0 max-w-full items-center gap-1.5", className)} title={n}>
      <AvatarPessoa nome={n} email={email} className={tamanho} />
      <span className="min-w-0 truncate">{n}</span>
    </span>
  );
}
