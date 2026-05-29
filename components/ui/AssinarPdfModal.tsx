"use client";

import { useState, useEffect } from "react";
import { BadgeCheck, Eye, EyeOff, FileText, Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useUserStore } from "@/lib/store";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Email do profissional responsável — pré-seleciona no dropdown ao abrir. */
  defaultSignatoryEmail?: string;
  /** Tabela do documento (ex: "aet_relatorios"). Quando fornecido junto com docId,
   *  o PDF assinado é salvo no Storage em vez de ser baixado automaticamente. */
  tabelaNome?: string;
  /** ID do documento a ser assinado. */
  docId?: string;
  /** Callback chamado após assinatura bem-sucedida (com tabelaNome + docId). */
  onAssinado?: () => void;
  /**
   * PDF já gerado pelo caller (ex: BotaoGerarPdf).
   * Quando fornecido, a etapa gerarPdfBase() é pulada — o documento não é
   * renderizado novamente, garantindo que o layout assinado seja idêntico ao
   * PDF original exibido ao usuário.
   */
  pdfBytes?: ArrayBuffer;
}

type Step = "idle" | "gerando" | "assinando";

type Signatario = {
  id_usuario: string;
  nome: string;
  email: string;
  cargo: string | null;
};

export default function AssinarPdfModal({
  open,
  onClose,
  defaultSignatoryEmail,
  tabelaNome,
  docId,
  onAssinado,
  pdfBytes: pdfBytesFromCaller,
}: Props) {
  const user = useUserStore((s) => s.user);
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [erro, setErro] = useState<string | null>(null);

  const [signatarios, setSignatarios] = useState<Signatario[]>([]);
  const [emailSelecionado, setEmailSelecionado] = useState("");

  // Carrega profissionais com certificado A1 e pfx cadastrado
  useEffect(() => {
    if (!open) return;
    createSupabaseBrowserClient()
      .from("usuarios")
      .select("id_usuario, nome, email, cargo")
      .eq("tipo_certificado", "A1")
      .eq("ativo_sistema", true)
      .not("certificado_pfx_path", "is", null)
      .order("nome")
      .then(({ data }) => {
        const lista = (data ?? []) as Signatario[];
        setSignatarios(lista);
        // Prioridade: responsável do documento > usuário logado > primeiro da lista
        const responsavel = defaultSignatoryEmail
          ? lista.find((s) => s.email === defaultSignatoryEmail)
          : null;
        const logado = lista.find((s) => s.email === user?.email);
        setEmailSelecionado(
          responsavel?.email ?? logado?.email ?? lista[0]?.email ?? ""
        );
      });
  }, [open, user?.email, defaultSignatoryEmail]);

  const signatarioAtual = signatarios.find((s) => s.email === emailSelecionado);

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
    if (!password) { setErro("Informe a senha do certificado."); return; }
    if (!emailSelecionado) { setErro("Selecione o profissional signatário."); return; }
    setErro(null);

    const salvarNoServidor = !!(tabelaNome && docId);

    try {
      // Se o caller já gerou o PDF (ex: BotaoGerarPdf), usa diretamente.
      // Caso contrário, gera agora — mantendo compatibilidade com o uso standalone.
      let pdfBytes: ArrayBuffer;
      if (pdfBytesFromCaller) {
        setStep("assinando");
        pdfBytes = pdfBytesFromCaller;
      } else {
        setStep("gerando");
        const { gerarHtmlParaPdf } = await import("@/lib/gerarHtmlParaPdf");
        pdfBytes = await gerarHtmlParaPdf();
      }

      setStep("assinando");
      const form = new FormData();
      form.append("pdf", new Blob([pdfBytes], { type: "application/pdf" }), "relatorio.pdf");
      form.append("password", password);
      form.append("signatoryEmail", emailSelecionado);
      if (tabelaNome) form.append("tabelaNome", tabelaNome);
      if (docId) form.append("docId", docId);

      const res = await fetch("/api/sign-pdf", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Erro ao assinar PDF");
      }

      if (salvarNoServidor) {
        // Novo comportamento: PDF salvo no servidor, sem download automático
        toast.success("Documento assinado com sucesso!");
        onAssinado?.();
        handleClose();
      } else {
        // Legado: baixa o PDF assinado
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "relatorio-assinado.pdf";
        a.click();
        // Firefox precisa que a URL ainda exista quando processa o clique —
        // revogar imediatamente causa download silencioso sem arquivo.
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        handleClose();
      }
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
        {/* Seleção do signatário */}
        {signatarios.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 text-xs">
            Nenhum profissional com Certificado A1 e arquivo .pfx cadastrado encontrado.
          </div>
        ) : (
          <div>
            <label className="mb-1 block font-medium text-gray-700">
              Profissional signatário
            </label>
            <select
              value={emailSelecionado}
              onChange={(e) => setEmailSelecionado(e.target.value)}
              disabled={loading}
              className="w-full rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 font-medium focus:border-blue-400 focus:outline-none disabled:opacity-60"
            >
              {signatarios.map((s) => (
                <option key={s.id_usuario} value={s.email}>
                  {s.nome}{s.cargo ? ` · ${s.cargo}` : ""}
                </option>
              ))}
            </select>
            {signatarioAtual && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-blue-600">
                <BadgeCheck className="size-3.5 shrink-0" />
                Certificado A1 ICP-Brasil · <strong>{signatarioAtual.nome}</strong>
              </div>
            )}
          </div>
        )}

        {/* Descrição */}
        <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
          <FileText className="mt-0.5 size-4 shrink-0 text-gray-400" />
          <p className="text-xs text-gray-600">
            {tabelaNome && docId
              ? "O relatório será capturado, assinado com o certificado A1 e salvo. Você poderá baixar o PDF assinado quando quiser."
              : "O relatório será capturado automaticamente e assinado com o certificado A1 do profissional selecionado. O PDF assinado será baixado em seguida."}
          </p>
        </div>

        {/* Senha */}
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

        {erro && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
            {erro}
          </p>
        )}

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
            disabled={loading || !password || !emailSelecionado}
            className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
          >
            {step === "gerando" ? (
              <><Loader2 className="size-4 animate-spin" /> Gerando PDF...</>
            ) : step === "assinando" ? (
              <><Loader2 className="size-4 animate-spin" /> Assinando...</>
            ) : (
              <><BadgeCheck className="size-4" /> Assinar</>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
