"use client";

import { useState } from "react";
import { BadgeCheck, Eye, EyeOff, FileText, Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useUserStore } from "@/lib/store";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Step = "idle" | "gerando" | "assinando";

export default function AssinarPdfModal({ open, onClose }: Props) {
  const user = useUserStore((s) => s.user);
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [erro, setErro] = useState<string | null>(null);

  function reset() {
    setPassword("");
    setShowPass(false);
    setErro(null);
    setStep("idle");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleAssinar() {
    if (!password) {
      setErro("Informe a senha do certificado.");
      return;
    }
    setErro(null);

    try {
      // Gera o PDF capturando o conteúdo atual da página
      setStep("gerando");
      const { gerarPdfDaPagina } = await import("@/lib/gerarPdfDaPagina");
      const pdfBytes = await gerarPdfDaPagina();

      // Envia para assinatura no servidor
      setStep("assinando");
      const form = new FormData();
      form.append(
        "pdf",
        new Blob([pdfBytes], { type: "application/pdf" }),
        "relatorio.pdf"
      );
      form.append("password", password);

      const res = await fetch("/api/sign-pdf", { method: "POST", body: form });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Erro ao assinar PDF");
      }

      // Dispara download do PDF assinado
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "relatorio-assinado.pdf";
      a.click();
      URL.revokeObjectURL(url);

      handleClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao assinar");
    } finally {
      setStep("idle");
    }
  }

  const loading = step !== "idle";

  return (
    <Modal open={open} onClose={handleClose} title="Assinar PDF com Certificado A1">
      <div className="space-y-4 text-sm">
        {/* Identificação do certificado */}
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-blue-800">
          <BadgeCheck className="size-4 shrink-0" />
          <span>
            Certificado A1 ICP-Brasil ·{" "}
            <strong>{user?.nome ?? "Usuário"}</strong>
          </span>
        </div>

        {/* Descrição do processo */}
        <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
          <FileText className="mt-0.5 size-4 shrink-0 text-gray-400" />
          <p className="text-xs text-gray-600">
            O relatório será capturado automaticamente e assinado com seu
            certificado A1. O PDF assinado será baixado em seguida.
          </p>
        </div>

        {/* Senha do certificado */}
        <div>
          <label className="mb-1 block font-medium text-gray-700">
            Senha do certificado A1
          </label>
          <div className="relative">
            <input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha do arquivo .pfx"
              className="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
              onKeyDown={(e) => e.key === "Enter" && !loading && handleAssinar()}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-gray-400">
            Senha definida ao emitir o certificado na Autoridade Certificadora
            (Serasa, Certisign, Valid, etc.). Nunca é armazenada.
          </p>
        </div>

        {/* Erro */}
        {erro && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
            {erro}
          </p>
        )}

        {/* Ações */}
        <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleAssinar}
            disabled={loading || !password}
            className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
          >
            {step === "gerando" ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Gerando PDF...
              </>
            ) : step === "assinando" ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Assinando...
              </>
            ) : (
              <>
                <BadgeCheck className="size-4" /> Assinar e Baixar
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
