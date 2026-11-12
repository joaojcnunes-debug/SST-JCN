"use client";

// Imagens no cartão, abaixo da descrição, e as peças que os comentários também usam (12/11/2026).
// Pedido do usuário: "conseguir inserir e colar imagens nos cartões que criamos". O Ctrl+V fica no TarefaModal
// (vale em qualquer aba da janela); aqui ficam o "Inserir imagem", o "Colar imagem copiada", as miniaturas e a imagem
// ampliada. As imagens são anexos (a aba Anexos continua mostrando todas).

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { ClipboardPaste, ExternalLink, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import StorageImg from "@/components/ui/StorageImg";
import { confirmar } from "@/components/ui/confirm";
import { useAnexos, useExcluirAnexo, urlAssinadaAnexo, type GestaoAnexo } from "@/lib/hooks/useGestao";
import { lerImagensCopiadas } from "@/lib/hooks/useImagensCartao";
import { separarImagens } from "@/lib/gestao/imagens-cartao";
import { useUserStore } from "@/lib/store";

const QUADRO = "size-24 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-100";

/** Arquivo ainda não enviado (Nova tarefa, comentário sendo escrito): miniatura pelo próprio arquivo. */
function useUrlDoArquivo(arquivo: File | null): string | null {
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

/**
 * Seção "Imagens" abaixo da descrição. Na tarefa salva, as imagens já gravadas; na Nova tarefa (e Nova subtarefa), as
 * que vão junto ao criar. `onAdicionar` decide entre gravar e guardar no rascunho (TarefaModal).
 */
export default function ImagensCartao({ idTarefa, podeAnexar, podeEditar, rascunho, onAdicionar, onTirarRascunho, enviando }: {
  idTarefa: string | null;
  podeAnexar: boolean;
  podeEditar: boolean;
  rascunho: File[];
  onAdicionar: (imagens: File[]) => void;
  onTirarRascunho: (i: number) => void;
  enviando: boolean;
}) {
  const { data: anexos = [] } = useAnexos(idTarefa);
  const { doCartao } = separarImagens(anexos);
  const excluir = useExcluirAnexo();
  const meuEmail = useUserStore((s) => s.user?.email?.toLowerCase() ?? null);
  const podeApagar = (a: GestaoAnexo) => podeEditar || (podeAnexar && !!meuEmail && a.created_by?.toLowerCase() === meuEmail);
  const inputRef = useRef<HTMLInputElement>(null);
  const [ampliada, setAmpliada] = useState<Ampliada | null>(null);

  if (!podeAnexar && doCartao.length === 0) return null;

  async function colarDoBotao() {
    const r = await lerImagensCopiadas();
    if (typeof r === "string") toast.error(r);
    else onAdicionar(r);
  }

  async function tirar(a: GestaoAnexo) {
    if (await confirmar({ title: "Excluir imagem?", description: `"${a.nome}" sai do cartão (e da aba Anexos).` })) {
      excluir.mutate({ id: a.id, storage_path: a.storage_path });
    }
  }

  return (
    <section aria-label="Imagens do cartão" className="mt-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-600">Imagens{doCartao.length + rascunho.length > 0 && ` (${doCartao.length + rascunho.length})`}</span>
        {podeAnexar && (
          <>
            <button type="button" onClick={() => inputRef.current?.click()} disabled={enviando}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-600 hover:border-marca-primary hover:text-marca-primary disabled:opacity-50">
              <ImagePlus className="size-3.5" /> Inserir imagem
            </button>
            <button type="button" onClick={() => void colarDoBotao()} disabled={enviando}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-600 hover:border-marca-primary hover:text-marca-primary disabled:opacity-50">
              <ClipboardPaste className="size-3.5" /> Colar imagem copiada
            </button>
            <span className="text-[11px] text-gray-400">ou Ctrl+V em qualquer lugar da janela</span>
            <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => { const l = Array.from(e.target.files ?? []); e.target.value = ""; if (l.length) onAdicionar(l); }} />
          </>
        )}
      </div>
      {doCartao.length + rascunho.length > 0 || enviando ? (
        <div className="flex flex-wrap gap-2">
          {doCartao.map((a) => (
            <MiniaturaSalva key={a.id} anexo={a} onAbrir={() => setAmpliada({ anexo: a })} onTirar={podeApagar(a) ? () => void tirar(a) : undefined} />
          ))}
          {rascunho.map((f, i) => (
            <MiniaturaRascunho key={`${i}-${f.name}`} arquivo={f} onAbrir={() => setAmpliada({ arquivo: f })} onTirar={() => onTirarRascunho(i)} />
          ))}
          {enviando && (
            <div className={`${QUADRO} flex items-center justify-center`} aria-label="Enviando imagem">
              <Loader2 className="size-5 animate-spin text-gray-400" />
            </div>
          )}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-gray-200 px-3 py-2 text-xs text-gray-400">
          Nenhuma imagem. Cole um print (Ctrl+V) ou use &ldquo;Inserir imagem&rdquo;.
        </p>
      )}
      {rascunho.length > 0 && <p className="mt-1 text-[11px] text-gray-400">As imagens tracejadas vão junto quando você criar.</p>}
      <ImagemAmpliada imagem={ampliada} onClose={() => setAmpliada(null)} />
    </section>
  );
}
