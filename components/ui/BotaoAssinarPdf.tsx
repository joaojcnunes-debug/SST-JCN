"use client";

import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import AssinarPdfModal from "@/components/ui/AssinarPdfModal";

/**
 * Botão "Assinar PDF A1" — abre o modal de seleção de profissional signatário.
 * Visível para qualquer usuário logado (o modal filtra quem tem cert A1 + pfx).
 */
export default function BotaoAssinarPdf() {
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

      <AssinarPdfModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
