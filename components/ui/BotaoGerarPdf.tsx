"use client";

import { Printer } from "lucide-react";
import type { RegistrarPdfOpts } from "@/lib/hooks/usePdfsGerados";

interface Props {
  label?: string;
  className?: string;
  disabled?: boolean;
  title?: string;
  // Mantidos para compatibilidade com callers existentes.
  // Não utilizados com window.print() pois o browser não expõe o buffer gerado.
  tabelaNome?: string;
  docId?: string;
  defaultSignatoryEmail?: string;
  registrarPdf?: RegistrarPdfOpts;
}

export default function BotaoGerarPdf({
  label = "Gerar PDF",
  className,
  disabled,
  title,
}: Props) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      disabled={disabled}
      title={title}
      className={className}
    >
      <Printer className="size-3.5" />
      {" "}{label}
    </button>
  );
}
