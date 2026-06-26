"use client";

import { useState } from "react";
import { BadgeCheck, Loader2, PenLine } from "lucide-react";
import toast from "react-hot-toast";
import AssinarPdfModal from "@/components/ui/AssinarPdfModal";
import AssinarImagemModal from "@/components/ui/AssinarImagemModal";

interface Props {
  /** Email do profissional responsável pelo documento (pré-seleção no modal). */
  defaultSignatoryEmail?: string;
  /** Nome do profissional responsável cadastrado no documento (pré-seleção por
   *  nome quando não há email — útil para laudos que guardam só o nome). */
  defaultSignatoryName?: string;
  /** Tabela do documento. Passado ao modal para salvar o PDF assinado no servidor. */
  tabelaNome?: string;
  /** ID do documento. Passado ao modal para salvar o PDF assinado no servidor. */
  docId?: string;
  /** Callback após assinatura bem-sucedida. */
  onAssinado?: () => void;
  /** Quando true, indica que o documento já foi assinado — exibe como ação secundária "Re-assinar". */
  reAssinatura?: boolean;
  /**
   * URL de API que retorna o PDF pronto (Content-Type: application/pdf).
   * Quando fornecida, substitui gerarHtmlParaPdf() pela chamada fetch à API.
   * Ideal para laudos com template Puppeteer (ex: /api/pdf/aep/[id]).
   */
  apiPdfUrl?: string;
  /**
   * URL do PDF BASE já congelado (arquivo imutável, Fase 4). Quando presente,
   * a assinatura opera sobre ESTE arquivo (não regenera) — garante que o
   * assinado é byte-a-byte o aprovado. Tem prioridade sobre apiPdfUrl.
   */
  baseCongeladaUrl?: string;
}

export default function BotaoAssinarPdf({
  defaultSignatoryEmail,
  defaultSignatoryName,
  tabelaNome,
  docId,
  onAssinado,
  reAssinatura = false,
  apiPdfUrl,
  baseCongeladaUrl,
}: Props) {
  const [open, setOpen] = useState(false);
  const [openImg, setOpenImg] = useState(false);
  const [capturando, setCapturando] = useState(false);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | undefined>();

  /**
   * Assinatura por imagem: registra no servidor (tipo='imagem'). Para laudos
   * com rota Puppeteer (apiPdfUrl) o servidor já regenera+salva o PDF com a
   * imagem. Para laudos por captura de tela, o servidor pede needsClientSave —
   * então fechamos o modal, deixamos a tela re-renderizar com a imagem e
   * capturamos o DOM para salvar.
   */
  async function handleAssinarImagem(signatoryEmail: string) {
    const res = await fetch("/api/sign-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signatoryEmail, tabelaNome, docId, apiPdfUrl }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error ?? "Erro ao assinar");

    if ((data as { needsClientSave?: boolean }).needsClientSave) {
      // Fecha o modal antes de capturar (evita o overlay interferir no canvas).
      setOpenImg(false);
      window.dispatchEvent(
        new CustomEvent("pdf:assinado", { detail: { tabelaNome, docId } }),
      );
      onAssinado?.();
      await new Promise((r) => setTimeout(r, 1400));
      const { gerarHtmlParaPdf } = await import("@/lib/gerarHtmlParaPdf");
      const bytes = await gerarHtmlParaPdf({ forSigning: true });
      const form = new FormData();
      form.append("pdf", new Blob([bytes], { type: "application/pdf" }), "assinado.pdf");
      if (tabelaNome) form.append("tabelaNome", tabelaNome);
      if (docId) form.append("docId", docId);
      const res2 = await fetch("/api/sign-image", { method: "POST", body: form });
      if (!res2.ok) {
        const d2 = await res2.json().catch(() => ({}));
        throw new Error((d2 as { error?: string }).error ?? "Erro ao salvar o PDF assinado");
      }
    }
    onAssinado?.();
    toast.success("Documento assinado com a imagem de assinatura!");
  }

  async function handleClick() {
    setCapturando(true);
    try {
      let bytes: ArrayBuffer;
      if (baseCongeladaUrl) {
        // Fase 4: assina sobre a base congelada (arquivo imutável), sem regenerar.
        const res = await fetch(baseCongeladaUrl);
        if (!res.ok) throw new Error("Falha ao baixar o PDF base congelado");
        bytes = await res.arrayBuffer();
      } else if (apiPdfUrl) {
        // Template Puppeteer: a API gera o PDF server-side e retorna o buffer.
        // assinado=1 → a rota já renderiza o selo digital no PDF que será
        // assinado (o registro em pdfs_assinados só nasce após assinar). Rotas
        // que não tratam o param simplesmente o ignoram (sem efeito colateral).
        const sep = apiPdfUrl.includes("?") ? "&" : "?";
        const res = await fetch(`${apiPdfUrl}${sep}assinado=1`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Erro ao gerar PDF" }));
          throw new Error((err as { error?: string }).error ?? "Erro ao gerar PDF");
        }
        bytes = await res.arrayBuffer();
      } else {
        // Legado: captura o DOM via html-to-image (executa antes de abrir o
        // modal para evitar que o overlay interfira com o SVG foreignObject).
        const { gerarHtmlParaPdf } = await import("@/lib/gerarHtmlParaPdf");
        bytes = await gerarHtmlParaPdf({ forSigning: true });
      }
      setPdfBytes(bytes);
      setOpen(true);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao capturar o documento. Tente novamente.",
      );
    } finally {
      setCapturando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={capturando}
        className={
          reAssinatura
            ? "inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-60 print:hidden"
            : "inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-white px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60 print:hidden"
        }
        title={
          reAssinatura
            ? "Substituir a assinatura existente"
            : "Assinar este PDF com certificado A1 ICP-Brasil"
        }
      >
        {capturando ? (
          <Loader2 className={reAssinatura ? "size-3.5 animate-spin" : "size-4 animate-spin"} />
        ) : (
          <BadgeCheck className={reAssinatura ? "size-3.5" : "size-4"} />
        )}
        {capturando ? "Gerando PDF..." : reAssinatura ? "Re-assinar" : "Assinar PDF A1"}
      </button>

      {!reAssinatura && (
        <button
          type="button"
          onClick={() => setOpenImg(true)}
          disabled={capturando}
          className="inline-flex items-center gap-1.5 rounded-md border border-verde-primary/40 bg-white px-3 py-1.5 text-sm font-semibold text-verde-primary hover:bg-verde-primary/5 disabled:opacity-60 print:hidden"
          title="Assinar carimbando a imagem de assinatura cadastrada no perfil"
        >
          <PenLine className="size-4" />
          Assinar com imagem
        </button>
      )}

      <AssinarImagemModal
        open={openImg}
        onClose={() => setOpenImg(false)}
        defaultSignatoryEmail={defaultSignatoryEmail}
        defaultSignatoryName={defaultSignatoryName}
        onConfirm={handleAssinarImagem}
      />

      <AssinarPdfModal
        open={open}
        onClose={() => {
          setOpen(false);
          setPdfBytes(undefined);
        }}
        defaultSignatoryEmail={defaultSignatoryEmail}
        defaultSignatoryName={defaultSignatoryName}
        tabelaNome={tabelaNome}
        docId={docId}
        onAssinado={onAssinado}
        pdfBytes={pdfBytes}
      />
    </>
  );
}
