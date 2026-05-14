"use client";

import { useState, useRef } from "react";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

interface PdfDropzoneProps {
  /** Arquivo selecionado (depois de carregar e extrair texto). */
  file: { nome: string; texto: string } | null;
  /** Callback chamado quando um arquivo é carregado com sucesso. */
  onChange: (file: { nome: string; texto: string } | null) => void;
  disabled?: boolean;
}

const MAX_SIZE_MB = 10;

export default function PdfDropzone({
  file,
  onChange,
  disabled,
}: PdfDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const [extraindo, setExtraindo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(f: File) {
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Apenas arquivos PDF são aceitos");
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Arquivo maior que ${MAX_SIZE_MB} MB`);
      return;
    }

    setExtraindo(true);
    try {
      // Importação dinâmica do pdfjs-dist — biblioteca pesada, só baixa quando
      // o usuário realmente vai usar o modo PDF.
      const pdfjs = await import("pdfjs-dist");
      // Worker em CDN pra evitar configuração de bundler (Next.js + pdfjs é
      // notoriamente chato com worker local).
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

      const buffer = await f.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: buffer }).promise;

      let texto = "";
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const linha = content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ");
        texto += `\n=== Página ${p} ===\n${linha}\n`;
      }

      if (!texto.trim()) {
        toast.error(
          "PDF parece ser somente imagem (escaneado). Use o modo Manual ou um PDF com texto."
        );
        return;
      }

      onChange({ nome: f.name, texto: texto.trim() });
      toast.success(`Texto extraído (${pdf.numPages} página(s))`);
    } catch (e) {
      toast.error(
        e instanceof Error ? `Falha ao ler PDF: ${e.message}` : "Falha ao ler PDF"
      );
    } finally {
      setExtraindo(false);
    }
  }

  if (file) {
    return (
      <div className="rounded-lg border-2 border-verde-border bg-verde-light/30 p-4">
        <div className="flex items-center gap-3">
          <FileText className="size-8 shrink-0 text-verde-primary" />
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">
              {file.nome}
            </p>
            <p className="text-xs text-gray-500">
              {file.texto.length.toLocaleString()} caracteres extraídos
            </p>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-alert"
              title="Remover arquivo"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <label
      className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors ${
        dragging
          ? "border-verde-primary bg-verde-light/30"
          : "border-gray-300 bg-gray-50 hover:bg-gray-100"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (disabled) return;
        const f = e.dataTransfer.files?.[0];
        if (f) handleFile(f);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        disabled={disabled || extraindo}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      {extraindo ? (
        <>
          <Loader2 className="size-10 animate-spin text-verde-primary" />
          <p className="text-sm text-gray-600">Extraindo texto do PDF...</p>
        </>
      ) : (
        <>
          <Upload className="size-10 text-gray-400" />
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-700">
              Arraste o PDF da FDS/FISPQ aqui ou clique para selecionar
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Até {MAX_SIZE_MB} MB · Apenas PDFs com texto (não escaneados)
            </p>
          </div>
        </>
      )}
    </label>
  );
}
