"use client";

import { useState } from "react";
import { BadgeCheck, Loader2, Printer } from "lucide-react";
import AssinarPdfModal from "@/components/ui/AssinarPdfModal";
import { useRegistrarPdf } from "@/lib/hooks/usePdfsGerados";
import type { RegistrarPdfOpts } from "@/lib/hooks/usePdfsGerados";
import toast from "react-hot-toast";

interface Props {
  label?: string;
  className?: string;
  disabled?: boolean;
  title?: string;
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
  tabelaNome,
  docId,
  defaultSignatoryEmail,
  registrarPdf,
}: Props) {
  const [gerando, setGerando] = useState(false);
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [assinarOpen, setAssinarOpen] = useState(false);
  const registrar = useRegistrarPdf();

  async function handleGerar() {
    setGerando(true);
    setBuffer(null);
    try {
      const { gerarHtmlParaPdf } = await import("@/lib/gerarHtmlParaPdf");
      const ab = await gerarHtmlParaPdf();

      // Abre o PDF em nova aba para o usuário revisar
      const blob = new Blob([ab], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);

      // Mantém buffer para o fluxo de assinatura
      setBuffer(ab);

      // Registra geração no histórico se configurado
      if (registrarPdf) {
        registrar.mutate({ ...registrarPdf, pdfBuffer: ab });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar PDF");
    } finally {
      setGerando(false);
    }
  }

  function handleAssinado() {
    setAssinarOpen(false);
    setBuffer(null);
    // Notifica AssinaturaRelatorio (que pode estar em outra parte da árvore)
    if (tabelaNome && docId) {
      window.dispatchEvent(
        new CustomEvent("pdf:assinado", { detail: { tabelaNome, docId } })
      );
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleGerar}
        disabled={disabled || gerando}
        title={gerando ? undefined : title}
        className={className}
      >
        {gerando ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Printer className="size-3.5" />
        )}
        {" "}{gerando ? "Gerando..." : label}
      </button>

      {buffer && !gerando && (
        <button
          type="button"
          onClick={() => setAssinarOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 print:hidden"
        >
          <BadgeCheck className="size-3.5" />
          Assinar PDF A1
        </button>
      )}

      {buffer && (
        <AssinarPdfModal
          open={assinarOpen}
          onClose={() => setAssinarOpen(false)}
          pdfBytes={buffer}
          defaultSignatoryEmail={defaultSignatoryEmail}
          tabelaNome={tabelaNome}
          docId={docId}
          onAssinado={handleAssinado}
        />
      )}
    </>
  );
}
