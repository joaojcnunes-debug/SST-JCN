"use client";

// Peças das imagens do cartão (12/11/2026): miniaturas dos comentários e a imagem ampliada, que a descrição também usa.
// As imagens são anexos (a aba Anexos continua mostrando todas). Desde o 2º pedido do dia ("toda imagem colada ou
// inserida fique dentro do campo de descrição") não há mais seção de imagens embaixo da descrição: todas ficam DENTRO
// dela (components/gestao/DescricaoComImagens.tsx).

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ExternalLink, Trash2, X } from "lucide-react";
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

/** A imagem grande, numa janela por cima (Esc ou clique fora fecham só ela). */
export function ImagemAmpliada({ imagem, onClose }: { imagem: Ampliada | null; onClose: () => void }) {
  const arquivo = imagem && "arquivo" in imagem ? imagem.arquivo : null;
  const urlArquivo = useUrlDoArquivo(arquivo);
  if (!imagem) return null;
  const nome = "anexo" in imagem ? imagem.anexo.nome : imagem.arquivo.name;
  async function abrirEmAba() {
    if (!imagem || !("anexo" in imagem)) return;
    const url = await urlAssinadaAnexo(imagem.anexo.storage_path);
    if (url) window.open(url, "_blank", "noopener");
    else toast.error("Não foi possível abrir a imagem.");
  }
  return (
    <Modal open onClose={onClose} title={nome} size="2xl">
      <div className="flex flex-col items-center gap-3 p-4">
        {"anexo" in imagem ? (
          <StorageImg stored={imagem.anexo.storage_path} bucket="anexos" alt={nome} className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain" />
        ) : urlArquivo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={urlArquivo} alt={nome} className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain" />
        ) : null}
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
