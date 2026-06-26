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
  /** Quando setado, gera o PDF pelo template Puppeteer server-side (rota
   *  /api/pdf/...) em vez de capturar a página — PDF vetorial e idêntico ao
   *  que é assinado. */
  apiPdfUrl?: string;
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
  apiPdfUrl,
}: Props) {
  const [gerando, setGerando] = useState(false);
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [assinarOpen, setAssinarOpen] = useState(false);
  const registrar = useRegistrarPdf();

  async function handleGerar() {
    setGerando(true);
    setBuffer(null);
    try {
      // Template Puppeteer server-side (vetorial, idêntico ao assinado).
      const ab = apiPdfUrl
        ? await fetch(apiPdfUrl).then(async (res) => {
            if (!res.ok) {
              const e = await res.json().catch(() => ({ error: "Erro ao gerar PDF" }));
              throw new Error((e as { error?: string }).error ?? "Erro ao gerar PDF");
            }
            return res.arrayBuffer();
          })
        : await (await import("@/lib/gerarHtmlParaPdf")).gerarHtmlParaPdf();

      // Abre o PDF: no Electron usa o leitor padrão do sistema (blob: não
      // pode ser aberto externamente); no browser abre em nova aba.
      if (typeof window !== "undefined" && window.electronAPI?.isElectron) {
        await window.electronAPI.abrirPdf(new Uint8Array(ab));
        // Mantém buffer para o fluxo de assinatura (só no desktop)
        setBuffer(ab);
      } else if (ab.byteLength > 0) {
        // Fallback: serviço externo retornou bytes — abre como blob
        const blob = new Blob([ab], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank", "noopener");
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        setBuffer(ab);
      }
      // se ab.byteLength === 0: window.print() foi chamado, sem buffer

      // Registra geração no histórico se configurado (só com buffer real)
      if (registrarPdf && ab.byteLength > 0) {
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
