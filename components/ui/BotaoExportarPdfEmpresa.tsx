"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

/**
 * "Exportar PDF" das páginas por empresa do Painel SST (Riscos Psicossociais e
 * AEP). O PDF é montado no servidor (`url` = rota /api/pdf/...) e abre numa
 * aba, como os outros PDFs do painel — quem quer o arquivo salva do próprio
 * visualizador.
 */
export default function BotaoExportarPdfEmpresa({ url, disabled }: { url: string; disabled?: boolean }) {
  const [gerando, setGerando] = useState(false);

  async function exportar() {
    // A aba abre JÁ no clique: depois do `await` o navegador trata como pop-up e bloqueia.
    const aba = window.open("", "_blank");
    setGerando(true);
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        const corpo = await resp.json().catch(() => null);
        throw new Error(corpo?.error ?? `O servidor respondeu ${resp.status}`);
      }
      const link = URL.createObjectURL(await resp.blob());
      if (aba) aba.location.href = link;
      else window.open(link, "_blank");
    } catch (e) {
      aba?.close();
      toast.error(e instanceof Error ? e.message : "Falha ao gerar o PDF");
    } finally {
      setGerando(false);
    }
  }

  return (
    <button
      type="button"
      onClick={exportar}
      disabled={disabled || gerando}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
    >
      {gerando ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
      {gerando ? "Gerando…" : "Exportar PDF"}
    </button>
  );
}
