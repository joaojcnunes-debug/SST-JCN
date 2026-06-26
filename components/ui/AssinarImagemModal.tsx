"use client";

import { useState, useEffect } from "react";
import { BadgeCheck, FileImage, Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import StorageImg from "@/components/ui/StorageImg";
import { useUserStore } from "@/lib/store";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Nome do responsável cadastrado no documento — pré-seleciona por nome. */
  defaultSignatoryName?: string;
  /** Email do responsável — pré-seleciona por email (prioridade). */
  defaultSignatoryEmail?: string;
  /** Chamado ao confirmar; recebe o email do signatário. Deve lançar em erro. */
  onConfirm: (signatoryEmail: string) => Promise<void>;
}

type Signatario = {
  id_usuario: string;
  nome: string;
  email: string;
  cargo: string | null;
  assinatura_url: string | null;
};

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
const wordMatch = (a: string, b: string) => {
  const words = norm(a).split(" ").filter((w) => w.length > 2);
  return words.length > 0 && words.every((w) => norm(b).includes(w));
};
const nameMatches = (a: string, b: string) =>
  norm(a) === norm(b) ||
  norm(a).includes(norm(b)) ||
  norm(b).includes(norm(a)) ||
  wordMatch(a, b) ||
  wordMatch(b, a);

export default function AssinarImagemModal({
  open,
  onClose,
  defaultSignatoryName,
  defaultSignatoryEmail,
  onConfirm,
}: Props) {
  const user = useUserStore((s) => s.user);
  const [signatarios, setSignatarios] = useState<Signatario[]>([]);
  const [emailSelecionado, setEmailSelecionado] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErro(null);
    createSupabaseBrowserClient()
      .from("usuarios")
      .select("id_usuario, nome, email, cargo, assinatura_url")
      .eq("ativo_sistema", true)
      .not("assinatura_url", "is", null)
      .order("nome")
      .then(({ data }) => {
        const lista = (data ?? []) as Signatario[];
        setSignatarios(lista);
        const porEmail = defaultSignatoryEmail
          ? lista.find((s) => s.email === defaultSignatoryEmail)
          : null;
        const porNome =
          !porEmail && defaultSignatoryName?.trim()
            ? lista.find((s) => nameMatches(s.nome, defaultSignatoryName))
            : null;
        const logado = lista.find((s) => s.email === user?.email);
        setEmailSelecionado(
          porEmail?.email ?? porNome?.email ?? logado?.email ?? lista[0]?.email ?? "",
        );
      });
  }, [open, user?.email, defaultSignatoryName, defaultSignatoryEmail]);

  const atual = signatarios.find((s) => s.email === emailSelecionado);

  async function handleConfirm() {
    if (!emailSelecionado) {
      setErro("Selecione o profissional signatário.");
      return;
    }
    setErro(null);
    setLoading(true);
    try {
      await onConfirm(emailSelecionado);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao assinar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={loading ? () => {} : onClose} title="Assinar com imagem de assinatura">
      <div className="space-y-4 text-sm">
        {signatarios.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Nenhum profissional com imagem de assinatura cadastrada no perfil.
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
              className="w-full rounded-md border border-verde-primary/30 bg-verde-primary/5 px-3 py-2 text-sm font-medium text-gray-800 focus:border-verde-primary focus:outline-none disabled:opacity-60"
            >
              {signatarios.map((s) => (
                <option key={s.id_usuario} value={s.email}>
                  {s.nome}
                  {s.cargo ? ` · ${s.cargo}` : ""}
                </option>
              ))}
            </select>
            {atual?.assinatura_url && (
              <div className="mt-2 flex items-center gap-2 rounded-md border border-gray-200 bg-white p-2">
                <StorageImg
                  stored={atual.assinatura_url}
                  alt="Assinatura"
                  className="max-h-12 max-w-[120px] object-contain"
                />
                <span className="text-[11px] text-gray-500">
                  Imagem que será carimbada na folha de assinaturas
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
          <FileImage className="mt-0.5 size-4 shrink-0 text-gray-400" />
          <p className="text-xs text-gray-600">
            A imagem de assinatura do profissional será carimbada na folha de
            assinaturas e o documento ficará marcado como assinado. Não é uma
            assinatura criptográfica ICP-Brasil — para validade legal completa,
            use “Assinar PDF A1”.
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
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || !emailSelecionado}
            className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Assinando...
              </>
            ) : (
              <>
                <BadgeCheck className="size-4" /> Assinar
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
