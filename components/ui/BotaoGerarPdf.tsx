"use client";

import { useState } from "react";
import { BadgeCheck, Download, Loader2, Printer } from "lucide-react";
import Modal from "@/components/ui/Modal";
import AssinarPdfModal from "@/components/ui/AssinarPdfModal";

interface Props {
  label?: string;
  className?: string;
  disabled?: boolean;
  tabelaNome?: string;
  docId?: string;
  defaultSignatoryEmail?: string;
}

type Step = "idle" | "gerando" | "perguntar" | "assinar";

/**
 * Substitui o botão window.print() em todas as páginas de relatório.
 *
 * Fluxo:
 *   1. Gera PDF com gerarPdfBase() (uma única vez)
 *   2. Pergunta: "Deseja assinar digitalmente?"
 *   3a. Não → abre PDF em nova aba
 *   3b. Sim → abre AssinarPdfModal com o PDF já gerado (sem regenerar)
 *
 * Após assinar, dispara o evento "pdf:assinado" para que AssinaturaRelatorio
 * recarregue o estado sem precisar de prop drilling.
 */
export default function BotaoGerarPdf({
  label = "Gerar PDF",
  className,
  disabled,
  tabelaNome,
  docId,
  defaultSignatoryEmail,
}: Props) {
  const [step, setStep] = useState<Step>("idle");
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function handleGerar() {
    setErro(null);
    setStep("gerando");
    try {
      const { gerarPdfBase } = await import("@/lib/gerarPdfBase");
      const buf = await gerarPdfBase();
      setPdfBuffer(buf);
      setStep("perguntar");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao gerar PDF");
      setStep("idle");
    }
  }

  function handleBaixarSemAssinar() {
    if (!pdfBuffer) return;
    const url = URL.createObjectURL(new Blob([pdfBuffer], { type: "application/pdf" }));
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    resetFlow();
  }

  function handleAssinado() {
    if (tabelaNome && docId) {
      window.dispatchEvent(
        new CustomEvent("pdf:assinado", { detail: { tabelaNome, docId } })
      );
    }
    resetFlow();
  }

  function resetFlow() {
    setStep("idle");
    setPdfBuffer(null);
    setErro(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleGerar}
        disabled={disabled || step === "gerando"}
        className={className}
      >
        {step === "gerando" ? (
          <><Loader2 className="size-3.5 animate-spin" /> Gerando...</>
        ) : (
          <><Printer className="size-3.5" /> {label}</>
        )}
      </button>

      {erro && (
        <span className="text-xs text-red-600">{erro}</span>
      )}

      {/* Passo 2: perguntar se deseja assinar */}
      <Modal
        open={step === "perguntar"}
        onClose={resetFlow}
        title="PDF gerado"
        size="sm"
      >
        <div className="space-y-4 text-sm">
          <div className="flex items-start gap-3 rounded-lg border border-verde-primary/20 bg-verde-light/30 px-3 py-3">
            <BadgeCheck className="mt-0.5 size-4 shrink-0 text-verde-primary" />
            <p className="text-xs font-medium text-verde-primary leading-relaxed">
              PDF gerado com sucesso. Deseja assinar digitalmente este documento com Certificado A1 ICP-Brasil?
            </p>
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            A assinatura digital ICP-Brasil garante autenticidade e integridade legal, sendo válida no GOV.BR, Adobe Acrobat e validadores oficiais.
          </p>
          <div className="flex flex-col gap-2 border-t border-gray-100 pt-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleBaixarSemAssinar}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download className="size-4" />
              Baixar sem assinar
            </button>
            <button
              type="button"
              onClick={() => setStep("assinar")}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent"
            >
              <BadgeCheck className="size-4" />
              Assinar digitalmente
            </button>
          </div>
        </div>
      </Modal>

      {/* Passo 3b: assinar com o PDF já gerado */}
      <AssinarPdfModal
        open={step === "assinar"}
        onClose={resetFlow}
        defaultSignatoryEmail={defaultSignatoryEmail}
        tabelaNome={tabelaNome}
        docId={docId}
        onAssinado={handleAssinado}
        pdfBytes={pdfBuffer ?? undefined}
      />
    </>
  );
}
