"use client";

// Caixa da descrição do cartão com as imagens DENTRO dela (12/11/2026) — regras em lib/gestao/descricao-imagens.ts.
// TipTap só com parágrafo, quebra de linha e imagem: a descrição continua sendo texto; cada imagem é uma linha com a
// marcação ![nome](anexo:id) e aparece aqui no lugar dela. Colar (Ctrl+V) ou arrastar uma imagem para dentro da
// caixa a coloca onde está o cursor; clique duplo amplia. Quem só lê vê o mesmo (clique amplia).

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, type Editor, type NodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { ImageOff } from "lucide-react";
import StorageImg from "@/components/ui/StorageImg";
import { ImagemAmpliada, useUrlDoArquivo, type Ampliada } from "@/components/gestao/ImagensCartao";
import type { GestaoAnexo } from "@/lib/hooks/useGestao";
import { docParaTexto, textoParaDoc, type NoDoc } from "@/lib/gestao/descricao-imagens";

/** De onde vem cada imagem: anexo já salvo (por id) ou arquivo colado que sobe ao Salvar/Criar. */
interface Fontes {
  salvas: Map<string, GestaoAnexo>;
  pendentes: Map<string, File>;
  ampliar: (a: Ampliada) => void;
}
const FontesCtx = createContext<Fontes>({ salvas: new Map(), pendentes: new Map(), ampliar: () => {} });

function ImagemNaDescricao({ node, selected, editor }: NodeViewProps) {
  const { salvas, pendentes, ampliar } = useContext(FontesCtx);
  const id = typeof node.attrs.anexo === "string" ? node.attrs.anexo : null;
  const nome = String(node.attrs.alt || "imagem");
  const salva = id ? salvas.get(id) : undefined;
  const pendente = id ? pendentes.get(id) : undefined;
  const urlPendente = useUrlDoArquivo(pendente ?? null);
  const abrir = () => { if (salva) ampliar({ anexo: salva }); else if (pendente) ampliar({ arquivo: pendente }); };
  return (
    <NodeViewWrapper className="my-1.5" data-imagem-descricao="">
      <div
        onClick={() => { if (!editor.isEditable) abrir(); }}
        onDoubleClick={abrir}
        title={editor.isEditable ? `${nome} (clique duplo amplia; selecione e apague com Delete)` : `${nome} (clique para ampliar)`}
        className={`inline-block max-w-full cursor-pointer rounded-md ${selected ? "ring-2 ring-marca-primary ring-offset-1" : ""}`}
      >
        {salva ? (
          <StorageImg stored={salva.storage_path} bucket="anexos" alt={nome} className="block max-h-96 max-w-full rounded-md object-contain" />
        ) : urlPendente ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={urlPendente} alt={nome} className="block max-h-96 max-w-full rounded-md object-contain opacity-90" />
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-500">
            <ImageOff className="size-3.5" /> Imagem indisponível ({nome})
          </span>
        )}
      </div>
      {pendente && <p className="mt-0.5 text-[11px] text-gray-400">Entra no cartão ao salvar.</p>}
    </NodeViewWrapper>
  );
}

const ImagemDaDescricao = Image.extend({
  // Só a imagem que é anexo deste cartão (a cópia de dentro da caixa leva o data-anexo; ver transformPastedHTML).
  parseHTML() {
    return [{ tag: "img[data-anexo]" }];
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      anexo: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-anexo"),
        renderHTML: (a: Record<string, unknown>) => (a.anexo ? { "data-anexo": a.anexo } : {}),
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImagemNaDescricao);
  },
}).configure({ inline: false, allowBase64: false });

export interface ImagemParaInserir { id: string; nome: string }
/** Pedido de fora do editor (botões, Ctrl+V em outro lugar da janela): onde = "cursor" (último lugar do cursor) ou "fim". */
export interface PedidoInserir { imagens: ImagemParaInserir[]; onde: "cursor" | "fim" }

function inserir(editor: Editor | null, imagens: ImagemParaInserir[], onde: "cursor" | "fim") {
  if (!editor || editor.isDestroyed || !imagens.length) return;
  const nos: NoDoc[] = imagens.map((i) => ({ type: "image", attrs: { anexo: i.id, alt: i.nome } }));
  const sel = editor.state.selection;
  // Sempre ACRESCENTA: no fim, depois do último bloco; no cursor, se uma imagem está selecionada (acabou de entrar ou
  // foi clicada), logo depois dela — insertContent sobre a seleção trocaria a imagem pela nova.
  if (onde === "fim") editor.chain().insertContentAt(editor.state.doc.content.size, nos).focus("end").run();
  else if ("node" in sel && sel.node) editor.chain().insertContentAt(sel.to, nos).focus().run();
  else editor.chain().focus().insertContent(nos).run();
}

export default function DescricaoComImagens({
  valor, onChange, ro, salvas, pendentes, onImagens, pedido, onPedidoAtendido, compacta = false, rotulo = "Descrição", vazio = "Sem descrição.",
}: {
  valor: string;
  onChange?: (texto: string) => void;
  ro: boolean;
  salvas: Map<string, GestaoAnexo>;
  pendentes: Map<string, File>;
  /** Imagens coladas/soltas DENTRO da caixa: quem chama guarda os arquivos e devolve id + nome de cada uma. */
  onImagens?: (arquivos: File[]) => ImagemParaInserir[];
  pedido?: PedidoInserir | null;
  onPedidoAtendido?: () => void;
  /** Subtarefa e "Do cartão original": caixa mais baixa. */
  compacta?: boolean;
  rotulo?: string;
  vazio?: string;
}) {
  const [ampliada, setAmpliada] = useState<Ampliada | null>(null);
  // O que o editor mandou por último: o valor que volta do pai igual a isto não é recarregado (o cursor não pula).
  const ultimoRef = useRef<string | null>(null);
  // Só depois de a descrição estar carregada na caixa ela pode mandar mudanças: se o carregamento falhasse, a 1ª tecla
  // gravaria a caixa vazia por cima da descrição.
  const carregadoRef = useRef(false);
  const editorRef = useRef<Editor | null>(null);
  const onChangeRef = useRef(onChange);
  const onImagensRef = useRef(onImagens);
  const fontesRef = useRef({ salvas, pendentes });
  useEffect(() => { onChangeRef.current = onChange; onImagensRef.current = onImagens; fontesRef.current = { salvas, pendentes }; });

  function imagensDoEvento(lista: FileList | null | undefined): File[] {
    return Array.from(lista ?? []).filter((f) => f.type.startsWith("image/"));
  }

  const editor = useEditor({
    immediatelyRender: false,
    editable: !ro,
    extensions: [
      StarterKit.configure({
        bold: false, italic: false, strike: false, underline: false, code: false, codeBlock: false, blockquote: false,
        heading: false, horizontalRule: false, bulletList: false, orderedList: false, listItem: false, listKeymap: false,
        link: false, trailingNode: false,
      }),
      ImagemDaDescricao,
    ],
    content: textoParaDoc(valor),
    onUpdate: ({ editor: ed }) => {
      if (!carregadoRef.current) return;
      const texto = docParaTexto(ed.getJSON() as NoDoc);
      ultimoRef.current = texto;
      onChangeRef.current?.(texto);
    },
    editorProps: {
      attributes: {
        class: `outline-none whitespace-pre-wrap break-words text-sm text-gray-800 ${compacta ? "min-h-[7rem]" : "min-h-[16rem]"}`,
        "aria-label": rotulo,
      },
      // Ctrl+Enter é o "Salvar" da janela do cartão: aqui não vira quebra de linha (a janela recebe a tecla e salva).
      handleKeyDown: (_view, e) => e.key === "Enter" && (e.ctrlKey || e.metaKey),
      // Imagem de site colada junto com texto não entra (não é anexo; sumiria ao salvar). Recortar e colar uma imagem
      // DENTRO da caixa move a imagem: ela vem com o data-anexo de um anexo deste cartão (de outro cartão, não).
      transformPastedHTML: (html) => html.replace(/<img\b[^>]*>/gi, (tag) => {
        const id = /\bdata-anexo="([^"]+)"/i.exec(tag)?.[1]?.toLowerCase();
        const { salvas, pendentes } = fontesRef.current;
        return id && (salvas.has(id) || pendentes.has(id)) ? tag : "";
      }),
      handlePaste: (_view, event) => {
        const imagens = imagensDoEvento(event.clipboardData?.files);
        if (!imagens.length || !onImagensRef.current) return false;
        // Do Word vem texto + uma imagem do trecho: aí é colar texto.
        if ((event.clipboardData?.getData("text/plain") ?? "").trim()) return false;
        event.preventDefault();
        inserir(editorRef.current, onImagensRef.current(imagens), "cursor");
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved || !onImagensRef.current) return false;
        const imagens = imagensDoEvento(event.dataTransfer?.files);
        if (!imagens.length) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        if (pos != null) editorRef.current?.commands.setTextSelection(pos);
        inserir(editorRef.current, onImagensRef.current(imagens), "cursor");
        return true;
      },
    },
  });
  useEffect(() => { editorRef.current = editor; }, [editor]);

  useEffect(() => { editor?.setEditable(!ro); }, [editor, ro]);

  // Valor que muda de fora (abriu o cartão, IA redigiu, modelo aplicado, "Criar outra"): recarrega a caixa.
  // Fora do ciclo de desenho do React (microtarefa): a imagem é um componente React dentro do editor, e criá-lo durante
  // um efeito dá "flushSync was called from inside a lifecycle method" e a caixa ficava vazia.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (valor === ultimoRef.current) return;
    const alvo = valor;
    queueMicrotask(() => {
      if (editor.isDestroyed) return;
      ultimoRef.current = alvo;
      editor.commands.setContent(textoParaDoc(alvo), { emitUpdate: false });
      carregadoRef.current = true;
    });
  }, [valor, editor]);

  // Pedido de fora (botões "Inserir imagem"/"Colar imagem copiada", Ctrl+V em outro lugar da janela).
  useEffect(() => {
    if (!editor || !pedido?.imagens.length) return;
    const { imagens, onde } = pedido;
    onPedidoAtendido?.();
    queueMicrotask(() => inserir(editor, imagens, onde));
  }, [editor, pedido, onPedidoAtendido]);

  const vazia = !valor.trim();
  return (
    <FontesCtx.Provider value={{ salvas, pendentes, ampliar: setAmpliada }}>
      <div
        data-descricao-editor=""
        className={ro
          ? "relative"
          : "relative rounded-md border border-gray-300 px-3 py-2 focus-within:border-marca-primary focus-within:ring-1 focus-within:ring-marca-primary/30"}
      >
        {vazia && (
          <p className={`pointer-events-none absolute text-sm text-gray-400 ${ro ? "left-0 top-0" : "left-3 top-2"}`} aria-hidden>
            {ro ? vazio : "Escreva a descrição… Para pôr uma imagem aqui, cole com Ctrl+V."}
          </p>
        )}
        <EditorContent editor={editor} />
      </div>
      <ImagemAmpliada imagem={ampliada} onClose={() => setAmpliada(null)} />
    </FontesCtx.Provider>
  );
}
