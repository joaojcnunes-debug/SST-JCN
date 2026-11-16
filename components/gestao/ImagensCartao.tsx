"use client";

// Peças das imagens do cartão (12/11/2026): miniaturas dos comentários e a imagem ampliada, que a descrição também usa
// (na descrição, com várias imagens, as setas do teclado passam de uma para outra).
// As imagens são anexos (a aba Anexos continua mostrando todas). Desde o 2º pedido do dia ("toda imagem colada ou
// inserida fique dentro do campo de descrição") não há mais seção de imagens embaixo da descrição: todas ficam DENTRO
// dela (components/gestao/DescricaoComImagens.tsx).

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { ChevronLeft, ChevronRight, ExternalLink, Trash2, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import StorageImg from "@/components/ui/StorageImg";
import { urlAssinadaAnexo, type GestaoAnexo } from "@/lib/hooks/useGestao";

const QUADRO = "size-24 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-100";

/** Arquivo ainda não enviado (Nova tarefa, comentário sendo escrito): miniatura pelo próprio arquivo. */
export function useUrlDoArquivo(arquivo: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!arquivo) { setUrl(null); return; }
    const u = URL.createObjectURL(arquivo);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [arquivo]);
  return url;
}

export type Ampliada = { anexo: GestaoAnexo } | { arquivo: File };

/** Várias imagens (as da descrição, 12/11/2026): as setas ← → do teclado e os botões dos lados trocam a imagem. */
export interface Galeria { atual: number; total: number; ir: (indice: number) => void }

const BOTAO_SETA =
  "shrink-0 rounded-full border border-gray-200 bg-white p-2 text-gray-600 shadow-sm hover:text-marca-primary disabled:cursor-default disabled:opacity-30 disabled:hover:text-gray-600";

/** A imagem grande, numa janela por cima (Esc ou clique fora fecham só ela). */
export function ImagemAmpliada({ imagem, onClose, galeria }: { imagem: Ampliada | null; onClose: () => void; galeria?: Galeria }) {
  const arquivo = imagem && "arquivo" in imagem ? imagem.arquivo : null;
  const urlArquivo = useUrlDoArquivo(arquivo);
  const varias = !!imagem && !!galeria && galeria.total > 1;
  const galeriaRef = useRef(galeria);
  useEffect(() => { galeriaRef.current = galeria; });
  // Na janela (fase de captura): vale com o foco em qualquer lugar dela, inclusive depois de clicar na imagem. Para
  // na primeira e na última (não dá a volta).
  useEffect(() => {
    if (!varias) return;
    function tecla(e: KeyboardEvent) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const g = galeriaRef.current;
      if (!g) return;
      e.preventDefault();
      e.stopPropagation();
      const destino = g.atual + (e.key === "ArrowRight" ? 1 : -1);
      if (destino >= 0 && destino < g.total) g.ir(destino);
    }
    window.addEventListener("keydown", tecla, true);
    return () => window.removeEventListener("keydown", tecla, true);
  }, [varias]);
  if (!imagem) return null;
  const nome = "anexo" in imagem ? imagem.anexo.nome : imagem.arquivo.name;
  async function abrirEmAba() {
    if (!imagem || !("anexo" in imagem)) return;
    const url = await urlAssinadaAnexo(imagem.anexo.storage_path);
    if (url) window.open(url, "_blank", "noopener");
    else toast.error("Não foi possível abrir a imagem.");
  }
  const foto = "anexo" in imagem ? (
    <StorageImg key={imagem.anexo.id} stored={imagem.anexo.storage_path} bucket="anexos" alt={nome} className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain" />
  ) : urlArquivo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={urlArquivo} alt={nome} className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain" />
  ) : null;
  return (
    <Modal open onClose={onClose} title={nome} size="2xl">
      <div className="flex flex-col items-center gap-3 p-4">
        {varias && galeria ? (
          <div className="flex w-full items-center justify-center gap-3">
            <button type="button" onClick={() => galeria.ir(galeria.atual - 1)} disabled={galeria.atual <= 0}
              aria-label="Imagem anterior" title="Imagem anterior (seta ←)" className={BOTAO_SETA}>
              <ChevronLeft className="size-5" />
            </button>
            <div className="flex min-w-0 flex-1 justify-center">{foto}</div>
            <button type="button" onClick={() => galeria.ir(galeria.atual + 1)} disabled={galeria.atual >= galeria.total - 1}
              aria-label="Próxima imagem" title="Próxima imagem (seta →)" className={BOTAO_SETA}>
              <ChevronRight className="size-5" />
            </button>
          </div>
        ) : foto}
        {varias && galeria && (
          <p className="text-xs text-gray-500" aria-live="polite">
            Imagem {galeria.atual + 1} de {galeria.total} · use as setas ← → do teclado para trocar
          </p>
        )}
        {"anexo" in imagem && (
          <button type="button" onClick={() => void abrirEmAba()} className="inline-flex items-center gap-1 text-xs font-medium text-marca-primary hover:underline">
            <ExternalLink className="size-3.5" /> Abrir em outra aba (tamanho original)
          </button>
        )}
      </div>
    </Modal>
  );
}

/** Miniatura de imagem já salva. */
export function MiniaturaSalva({ anexo, onAbrir, onTirar }: { anexo: GestaoAnexo; onAbrir: () => void; onTirar?: () => void }) {
  return (
    <div className="group relative">
      <button type="button" onClick={onAbrir} title={`${anexo.nome} (clique para ampliar)`} className={`${QUADRO} block hover:ring-2 hover:ring-marca-primary/40`}>
        <StorageImg stored={anexo.storage_path} bucket="anexos" alt={anexo.nome} loading="lazy" className="size-full object-cover" />
      </button>
      {onTirar && (
        <button type="button" onClick={onTirar} aria-label={`Excluir a imagem ${anexo.nome}`} title="Excluir a imagem"
          className="absolute right-1 top-1 rounded-md bg-white/90 p-1 text-gray-500 opacity-0 shadow-sm transition hover:text-red-600 focus:opacity-100 group-hover:opacity-100">
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** Miniatura de imagem que ainda vai ser enviada. */
export function MiniaturaRascunho({ arquivo, onAbrir, onTirar, pequena = false }: { arquivo: File; onAbrir: () => void; onTirar: () => void; pequena?: boolean }) {
  const url = useUrlDoArquivo(arquivo);
  return (
    <div className="group relative">
      <button type="button" onClick={onAbrir} title={`${arquivo.name} (vai junto ao salvar)`}
        className={`${pequena ? "size-14 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-100" : QUADRO} block border-dashed`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url && <img src={url} alt={arquivo.name} className="size-full object-cover" />}
      </button>
      <button type="button" onClick={onTirar} aria-label={`Tirar a imagem ${arquivo.name}`} title="Tirar"
        className="absolute -right-1.5 -top-1.5 rounded-full bg-white p-0.5 text-gray-500 shadow ring-1 ring-gray-200 hover:text-red-600">
        <X className="size-3" />
      </button>
    </div>
  );
}
