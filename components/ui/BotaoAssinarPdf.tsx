"use client";

import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import AssinarPdfModal from "@/components/ui/AssinarPdfModal";

interface Props {
  /** Email do profissional responsável pelo documento (pré-seleção no modal). */
  defaultSignatoryEmail?: string;
  /** Tabela do documento. Passado ao modal para salvar o PDF assinado no servidor. */
  tabelaNome?: string;
  /** ID do documento. Passado ao modal para salvar o PDF assinado no servidor. */
  docId?: string;
  /** Callback após assinatura bem-sucedida. */
  onAssinado?: () => void;
}

export default function BotaoAssinarPdf({
  defaultSignatoryEmail,
  tabelaNome,
  docId,
  onAssinado,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-white px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 print:hidden"
        title="Assinar este PDF com certificado A1 ICP-Brasil"
      >
        <BadgeCheck className="size-4" />
        Assinar PDF A1
      </button>

      <AssinarPdfModal
        open={open}
        onClose={() => setOpen(false)}
        defaultSignatoryEmail={defaultSignatoryEmail}
        tabelaNome={tabelaNome}
        docId={docId}
        onAssinado={onAssinado}
      />
    </>
  );
}
