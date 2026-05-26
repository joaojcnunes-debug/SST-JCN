"use client";

import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import { useUserStore } from "@/lib/store";
import AssinarPdfModal from "@/components/ui/AssinarPdfModal";

/**
 * Botão "Assinar PDF A1" — aparece apenas quando o usuário logado tem
 * tipo_certificado === 'A1' E certificado_pfx_path cadastrado.
 * Renderiza null para os demais usuários.
 */
export default function BotaoAssinarPdf() {
  const user = useUserStore((s) => s.user);
  const [open, setOpen] = useState(false);

  if (user?.tipo_certificado !== "A1" || !user?.certificado_pfx_path) return null;

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
