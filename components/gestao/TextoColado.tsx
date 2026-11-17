"use client";

// Texto grande colado no comentário, como arquivo .txt (0.3.295) — regras em lib/gestao/texto-colado.ts.
// Rascunho (antes de enviar), cartão salvo na conversa e a janela com o texto inteiro (copiar e baixar).

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ClipboardPaste, Copy, Download, FileText, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { urlAssinadaAnexo, type GestaoAnexo } from "@/lib/hooks/useGestao";
import { previaDoTexto, tamanhoDoTexto } from "@/lib/gestao/texto-colado";

export type TextoAberto = { anexo: GestaoAnexo } | { arquivo: File };

/** Lê o texto do arquivo (rascunho) ou do anexo salvo (URL assinada). */
function useConteudo(fonte: TextoAberto | null): { texto: string | null; erro: boolean } {
  const [estado, setEstado] = useState<{ texto: string | null; erro: boolean }>({ texto: null, erro: false });
  const chave = !fonte ? null : "anexo" in fonte ? fonte.anexo.storage_path : fonte.arquivo;
  useEffect(() => {
    let vivo = true;
    setEstado({ texto: null, erro: false });
    if (!fonte) return;
    (async () => {
      try {
        let texto: string;
        if ("arquivo" in fonte) texto = await fonte.arquivo.text();
        else {
          const url = await urlAssinadaAnexo(fonte.anexo.storage_path);
          if (!url) throw new Error("sem url");
          const r = await fetch(url);
          if (!r.ok) throw new Error(String(r.status));
          texto = await r.text();
        }
        if (vivo) setEstado({ texto, erro: false });
      } catch {
        if (vivo) setEstado({ texto: null, erro: true });
      }
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return estado;
}

const CARTAO = "flex w-full max-w-sm items-start gap-2 rounded-lg border bg-white p-2 text-left";

/** Texto colado que ainda vai ser enviado com o comentário. */
export function CartaoTextoRascunho({ arquivo, onVer, onColarComoTexto, onTirar }: {
  arquivo: File; onVer: () => void; onColarComoTexto: (texto: string) => void; onTirar: () => void;
}) {
  const { texto } = useConteudo({ arquivo });
  return (
    <div className={`${CARTAO} border-dashed border-gray-300`}>
      <FileText className="mt-0.5 size-5 shrink-0 text-marca-primary" />
      <div className="min-w-0 flex-1">
        <button type="button" onClick={onVer} className="block w-full text-left">
          <span className="block text-xs font-semibold text-gray-800">Texto colado · vai como arquivo .txt</span>
          <span className="block text-[11px] text-gray-500">{texto != null ? tamanhoDoTexto(texto) : arquivo.name}</span>
        </button>
        {texto != null && (
          <button type="button" onClick={() => onColarComoTexto(texto)} title="Desfazer: o texto entra na caixa, sem arquivo"
            className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-marca-primary hover:underline">
            <ClipboardPaste className="size-3" /> Colar como texto normal
          </button>
        )}
      </div>
      <button type="button" onClick={onTirar} aria-label="Tirar o texto colado" title="Tirar" className="rounded p-0.5 text-gray-400 hover:text-red-600">
        <X className="size-3.5" />
      </button>
    </div>
  );
}

/** Texto colado já enviado: cartão na conversa com as primeiras linhas. */
export function CartaoTextoSalvo({ anexo, onVer }: { anexo: GestaoAnexo; onVer: () => void }) {
  const { texto, erro } = useConteudo({ anexo });
  return (
    <button type="button" onClick={onVer} title="Abrir o texto inteiro" className={`${CARTAO} border-gray-200 hover:border-marca-primary/50`}>
      <FileText className="mt-0.5 size-5 shrink-0 text-marca-primary" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-gray-800">{anexo.nome}</span>
        <span className="block text-[11px] text-gray-500">{texto != null ? tamanhoDoTexto(texto) : erro ? "Não foi possível ler" : "Carregando…"}</span>
        {texto != null && <span className="mt-1 block whitespace-pre-line break-words font-mono text-[11px] leading-snug text-gray-600 line-clamp-3">{previaDoTexto(texto)}</span>}
        <span className="mt-1 block text-[11px] font-medium text-marca-primary">Abrir</span>
      </span>
    </button>
  );
}

/** O texto inteiro numa janela por cima, com Copiar e Baixar. */
export function TextoAmpliado({ fonte, onClose }: { fonte: TextoAberto | null; onClose: () => void }) {
  const { texto, erro } = useConteudo(fonte);
  if (!fonte) return null;
  const nome = "anexo" in fonte ? fonte.anexo.nome : fonte.arquivo.name;
  async function copiar() {
    if (texto == null) return;
    try { await navigator.clipboard.writeText(texto); toast.success("Texto copiado"); } catch { toast.error("Não foi possível copiar."); }
  }
  function baixar() {
    if (texto == null) return;
    const url = URL.createObjectURL(new Blob([texto], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = nome; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <Modal open onClose={onClose} title={nome} size="2xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-gray-500">{texto != null ? tamanhoDoTexto(texto) : ""}</span>
          <span className="flex gap-2">
            <button type="button" onClick={() => void copiar()} disabled={texto == null} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-50">
              <Copy className="size-4" /> Copiar
            </button>
            <button type="button" onClick={baixar} disabled={texto == null} className="inline-flex items-center gap-1.5 rounded-lg bg-marca-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-marca-dark disabled:opacity-50">
              <Download className="size-4" /> Baixar .txt
            </button>
          </span>
        </div>
      }>
      {erro ? (
        <p className="p-4 text-sm text-red-600">Não foi possível abrir o texto.</p>
      ) : texto == null ? (
        <p className="p-4 text-sm text-gray-500">Carregando…</p>
      ) : (
        <pre className="max-h-[65vh] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3 font-mono text-xs leading-relaxed text-gray-800">{texto}</pre>
      )}
    </Modal>
  );
}
