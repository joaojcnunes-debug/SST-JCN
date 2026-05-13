"use client";

import { useCallback, useEffect, useRef } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import toast from "react-hot-toast";
import {
  Bold,
  Italic,
  UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  Trash2,
  Undo,
  Redo,
  Loader2,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Nome do storage path/folder dentro do bucket 'fotos' onde gravar imagens. */
  uploadPathPrefix?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Escreva aqui...",
  uploadPathPrefix = "drps-texto-padrao",
}: Props) {
  const uploadingRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-verde-primary underline" },
      }),
      Image.configure({
        HTMLAttributes: { class: "rounded-md max-w-full" },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value || "",
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "tiptap-conteudo prose prose-sm max-w-none min-h-[200px] focus:outline-none px-3 py-2",
      },
    },
  });

  // Atualiza editor se value mudar de fora (ex.: trocou de capítulo)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    // Evita loop: só sincroniza se realmente mudou e não é a string vazia default
    if (value !== current) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!editor) return;
      if (uploadingRef.current) return;
      uploadingRef.current = true;
      const loadingId = toast.loading("Enviando imagem...");
      try {
        const supabase = createSupabaseBrowserClient();
        const ext = file.name.split(".").pop() ?? "png";
        const path = `${uploadPathPrefix}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("fotos")
          .upload(path, file, {
            cacheControl: "31536000",
            upsert: false,
            contentType: file.type || undefined,
          });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("fotos").getPublicUrl(path);
        if (!pub?.publicUrl) throw new Error("URL pública não retornada");
        editor.chain().focus().setImage({ src: pub.publicUrl }).run();
        toast.success("Imagem inserida", { id: loadingId });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Falha no upload";
        toast.error(msg, { id: loadingId });
      } finally {
        uploadingRef.current = false;
      }
    },
    [editor, uploadPathPrefix]
  );

  function setLink() {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL do link:", prev ?? "https://");
    if (url === null) return; // cancelado
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  function insertTable() {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }

  if (!editor) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-xs text-gray-500">
        <Loader2 className="mr-2 size-4 animate-spin" /> Carregando editor...
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-gray-300 bg-white">
      <Toolbar
        editor={editor}
        onPickImage={() => inputRef.current?.click()}
        onLink={setLink}
        onTable={insertTable}
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImageUpload(f);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      <EditorContent editor={editor} placeholder={placeholder} />
    </div>
  );
}

function Toolbar({
  editor,
  onPickImage,
  onLink,
  onTable,
}: {
  editor: Editor;
  onPickImage: () => void;
  onLink: () => void;
  onTable: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-1.5 py-1">
      <ToolButton
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Negrito (Ctrl+B)"
      >
        <Bold className="size-3.5" />
      </ToolButton>
      <ToolButton
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Itálico (Ctrl+I)"
      >
        <Italic className="size-3.5" />
      </ToolButton>
      <ToolButton
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Sublinhado (Ctrl+U)"
      >
        <UnderlineIcon className="size-3.5" />
      </ToolButton>
      <ToolButton
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Tachado"
      >
        <Strikethrough className="size-3.5" />
      </ToolButton>

      <Divider />

      <ToolButton
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        title="Título 1"
      >
        <Heading1 className="size-3.5" />
      </ToolButton>
      <ToolButton
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="Título 2"
      >
        <Heading2 className="size-3.5" />
      </ToolButton>
      <ToolButton
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        title="Título 3"
      >
        <Heading3 className="size-3.5" />
      </ToolButton>

      <Divider />

      <ToolButton
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Lista com marcadores"
      >
        <List className="size-3.5" />
      </ToolButton>
      <ToolButton
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Lista numerada"
      >
        <ListOrdered className="size-3.5" />
      </ToolButton>

      <Divider />

      <ToolButton
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        title="Alinhar à esquerda"
      >
        <AlignLeft className="size-3.5" />
      </ToolButton>
      <ToolButton
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        title="Centralizar"
      >
        <AlignCenter className="size-3.5" />
      </ToolButton>
      <ToolButton
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        title="Alinhar à direita"
      >
        <AlignRight className="size-3.5" />
      </ToolButton>
      <ToolButton
        active={editor.isActive({ textAlign: "justify" })}
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        title="Justificar"
      >
        <AlignJustify className="size-3.5" />
      </ToolButton>

      <Divider />

      <ToolButton
        active={editor.isActive("link")}
        onClick={onLink}
        title="Inserir/editar link"
      >
        <LinkIcon className="size-3.5" />
      </ToolButton>
      <ToolButton onClick={onPickImage} title="Inserir imagem">
        <ImageIcon className="size-3.5" />
      </ToolButton>
      <ToolButton onClick={onTable} title="Inserir tabela 3×3">
        <TableIcon className="size-3.5" />
      </ToolButton>
      {editor.isActive("table") && (
        <ToolButton
          onClick={() => editor.chain().focus().deleteTable().run()}
          title="Remover tabela"
          danger
        >
          <Trash2 className="size-3.5" />
        </ToolButton>
      )}

      <Divider />

      <ToolButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Desfazer"
      >
        <Undo className="size-3.5" />
      </ToolButton>
      <ToolButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Refazer"
      >
        <Redo className="size-3.5" />
      </ToolButton>
    </div>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-gray-300" />;
}

function ToolButton({
  active,
  disabled,
  danger,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "rounded p-1.5 text-gray-700 hover:bg-gray-200 disabled:opacity-30",
        active && "bg-verde-light text-verde-primary",
        danger && "text-red-alert hover:bg-red-50"
      )}
    >
      {children}
    </button>
  );
}
