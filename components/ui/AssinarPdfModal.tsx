"use client";

import { useRef, useState } from "react";
import { BadgeCheck, Eye, EyeOff, FileUp, Loader2, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useUserStore } from "@/lib/store";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AssinarPdfModal({ open, onClose }: Props) {
  const user = useUserStore((s) => s.user);
  const fileRef = useRef<HTMLInputElement>(null);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function reset() {
    setPdfFile(null);
    setPassword("");
    setShowPass(false);
    setErro(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleAssinar() {
    if (!pdfFile || !password) {
      setErro("Selecione o PDF e informe a senha do certificado.");
      return;
    }
    setErro(null);
    setLoading(true);

    try {
      const form = new FormData();
      form.append("pdf", pdfFile);
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
      setLoading(false);
    }
  }

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

        {/* Instruções */}
        <p className="text-gray-600">
          1. Gere o PDF do relatório usando o botão{" "}
          <strong>Imprimir / PDF</strong> e salve o arquivo.
          <br />
          2. Selecione o arquivo salvo abaixo e informe a senha do certificado.
          <br />
          3. Clique em <strong>Assinar e Baixar</strong> — o PDF assinado será
          baixado automaticamente.
        </p>

        {/* Upload do PDF */}
        <div>
          <label className="mb-1 block font-medium text-gray-700">
            Arquivo PDF do relatório
          </label>
          <div
            className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-3 hover:border-verde-primary hover:bg-green-50"
            onClick={() => fileRef.current?.click()}
          >
            <FileUp className="size-5 shrink-0 text-gray-400" />
            <span className="truncate text-gray-500">
              {pdfFile ? pdfFile.name : "Clique para selecionar o PDF"}
            </span>
            {pdfFile && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPdfFile(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="ml-auto rounded p-0.5 text-gray-400 hover:text-red-500"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
          />
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
              onKeyDown={(e) => e.key === "Enter" && handleAssinar()}
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
            É a senha que você definiu ao emitir o certificado na Autoridade
            Certificadora (Serasa, Certisign, Valid, etc.). Não é a senha do
            sistema. Nunca é armazenada.
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
            disabled={loading || !pdfFile || !password}
            className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
          >
            {loading ? (
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
