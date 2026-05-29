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
  /** Quando true, indica que o documento já foi assinado — exibe como ação secundária "Re-assinar". */
  reAssinatura?: boolean;
}

export default function BotaoAssinarPdf({
  defaultSignatoryEmail,
  tabelaNome,
  docId,
  onAssinado,
  reAssinatura = false,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          reAssinatura
            ? "inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 print:hidden"
            : "inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-white px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 print:hidden"
        }
        title={reAssinatura ? "Substituir a assinatura existente" : "Assinar este PDF com certificado A1 ICP-Brasil"}
      >
        <BadgeCheck className={reAssinatura ? "size-3.5" : "size-4"} />
        {reAssinatura ? "Re-assinar" : "Assinar PDF A1"}
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
