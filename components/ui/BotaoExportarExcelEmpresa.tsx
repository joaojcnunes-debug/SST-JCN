"use client";

import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

/**
 * "Exportar Excel" das páginas por empresa do Painel SST (Riscos Psicossociais e
 * AEP). A planilha é montada no navegador com o que a tela já carregou
 * (`lib/psicossocial/exportar-xlsx.ts`); `onExportar` baixa o arquivo.
 */
export default function BotaoExportarExcelEmpresa({
  onExportar,
  disabled,
}: {
  onExportar: () => Promise<void>;
  disabled?: boolean;
}) {
  const [gerando, setGerando] = useState(false);

  async function exportar() {
    setGerando(true);
    try {
      await onExportar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar a planilha");
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
      {gerando ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
      {gerando ? "Gerando…" : "Exportar Excel"}
    </button>
  );
}
