"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  Plus,
  Trash2,
  Bold,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Braces,
  ChevronDown,
} from "lucide-react";
import { useSignedUrl } from "@/lib/hooks/useSignedUrl";
import { VARIAVEIS } from "@/lib/drps/variaveis";
import type { CaixaTexto } from "@/lib/drps/types";
import { cn } from "@/lib/utils";

interface Props {
  bgImagemUrl: string;
  caixas: CaixaTexto[];
  onChange: (caixas: CaixaTexto[]) => void;
}

/**
 * Editor visual da capa: preview da pagina A4 (210x297) escalado para a
 * largura disponivel, com caixas de texto sobrepostas que podem ser
 * arrastadas com o mouse. Posicoes salvas em % para escalar igual ao PDF.
 */
export default function CapaEditor({ bgImagemUrl, caixas, onChange }: Props) {
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);

  const selecionada = caixas.find((c) => c.id === selecionadaId) ?? null;

  const adicionar = useCallback(() => {
    const novaCaixa: CaixaTexto = {
      id: crypto.randomUUID(),
      x: 10,
      y: 40,
      w: 50,
      fontSize: 16,
      align: "left",
      color: "#ffffff",
      conteudo: "Novo texto",
    };
    onChange([...caixas, novaCaixa]);
    setSelecionadaId(novaCaixa.id);
  }, [caixas, onChange]);

  const remover = useCallback(
    (id: string) => {
      onChange(caixas.filter((c) => c.id !== id));
      if (selecionadaId === id) setSelecionadaId(null);
    },
    [caixas, onChange, selecionadaId]
  );

  const atualizar = useCallback(
    (id: string, patch: Partial<CaixaTexto>) => {
      onChange(caixas.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    },
    [caixas, onChange]
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          Editor de capa — arraste as caixas para posicionar
        </span>
        <button
          type="button"
          onClick={adicionar}
          className="inline-flex items-center gap-1 rounded-md bg-verde-primary px-2 py-1 text-xs font-semibold text-white hover:bg-verde-accent"
        >
          <Plus className="size-3.5" /> Adicionar caixa
        </button>
      </div>

      <div className="flex justify-center">
        <PaginaPreview
          bgImagemUrl={bgImagemUrl}
          caixas={caixas}
          selecionadaId={selecionadaId}
          onSelect={setSelecionadaId}
          onChange={atualizar}
        />
      </div>

      {selecionada && (
        <PainelEdicao
          caixa={selecionada}
          onChange={(patch) => atualizar(selecionada.id, patch)}
          onRemover={() => remover(selecionada.id)}
        />
      )}
    </div>
  );
}

function PaginaPreview({
  bgImagemUrl,
  caixas,
  selecionadaId,
  onSelect,
  onChange,
}: {
  bgImagemUrl: string;
  caixas: CaixaTexto[];
  selecionadaId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<CaixaTexto>) => void;
}) {
  // A4 aspect ratio 210x297, preview a 480px de largura
  const PREVIEW_WIDTH = 480;
  const PREVIEW_HEIGHT = Math.round((PREVIEW_WIDTH * 297) / 210);

  // Resolve a imagem de fundo (bucket fotos) p/ URL assinada (fallback p/ a
  // original enquanto carrega / se for origem externa).
  const { data: bgAssinada } = useSignedUrl(bgImagemUrl, "fotos");
  const bgUrl = bgAssinada ?? bgImagemUrl;

  return (
    <div
      className="relative overflow-hidden rounded border border-gray-300 bg-gray-100 shadow-md"
      style={{
        width: PREVIEW_WIDTH,
        height: PREVIEW_HEIGHT,
        backgroundImage: `url(${bgUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onSelect(null);
      }}
    >
      {caixas.map((c) => (
        <CaixaArrastavel
          key={c.id}
          caixa={c}
          selecionada={c.id === selecionadaId}
          paginaW={PREVIEW_WIDTH}
          paginaH={PREVIEW_HEIGHT}
          onSelect={() => onSelect(c.id)}
          onChange={(patch) => onChange(c.id, patch)}
        />
      ))}
    </div>
  );
}

function CaixaArrastavel({
  caixa,
  selecionada,
  paginaW,
  paginaH,
  onSelect,
  onChange,
}: {
  caixa: CaixaTexto;
  selecionada: boolean;
  paginaW: number;
  paginaH: number;
  onSelect: () => void;
  onChange: (patch: Partial<CaixaTexto>) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const dragData = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: MouseEvent) {
      if (!dragData.current) return;
      const dx = e.clientX - dragData.current.startX;
      const dy = e.clientY - dragData.current.startY;
      const dxPct = (dx / paginaW) * 100;
      const dyPct = (dy / paginaH) * 100;
      const nx = Math.max(0, Math.min(100, dragData.current.origX + dxPct));
      const ny = Math.max(0, Math.min(100, dragData.current.origY + dyPct));
      onChange({ x: nx, y: ny });
    }
    function onUp() {
      setDragging(false);
      dragData.current = null;
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [dragging, onChange, paginaW, paginaH]);

  const style: CSSProperties = {
    position: "absolute",
    left: `${caixa.x}%`,
    top: `${caixa.y}%`,
    width: `${caixa.w ?? 40}%`,
    fontSize: caixa.fontSize ?? 16,
    fontWeight: caixa.bold ? 700 : 400,
    color: caixa.color ?? "#ffffff",
    textAlign: caixa.align ?? "left",
    cursor: dragging ? "grabbing" : "grab",
    userSelect: "none",
    whiteSpace: "pre-wrap",
    lineHeight: 1.3,
    textShadow: "0 1px 2px rgba(0,0,0,0.35)",
    padding: 4,
    border: selecionada ? "1.5px dashed #0ea5e9" : "1.5px dashed transparent",
    background: selecionada ? "rgba(0, 107, 84, 0.05)" : "transparent",
    borderRadius: 4,
  };

  return (
    <div
      style={style}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect();
        dragData.current = {
          startX: e.clientX,
          startY: e.clientY,
          origX: caixa.x,
          origY: caixa.y,
        };
        setDragging(true);
      }}
    >
      {caixa.conteudo || <span style={{ opacity: 0.5 }}>(vazio)</span>}
    </div>
  );
}

function PainelEdicao({
  caixa,
  onChange,
  onRemover,
}: {
  caixa: CaixaTexto;
  onChange: (patch: Partial<CaixaTexto>) => void;
  onRemover: () => void;
}) {
  const [varOpen, setVarOpen] = useState(false);
  const varRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!varOpen) return;
    function onClick(e: MouseEvent) {
      if (varRef.current && !varRef.current.contains(e.target as Node)) {
        setVarOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [varOpen]);

  function insertVariavel(chave: string) {
    const ta = taRef.current;
    if (!ta) {
      onChange({ conteudo: `${caixa.conteudo}{{${chave}}}` });
      setVarOpen(false);
      return;
    }
    const start = ta.selectionStart ?? caixa.conteudo.length;
    const end = ta.selectionEnd ?? caixa.conteudo.length;
    const before = caixa.conteudo.slice(0, start);
    const after = caixa.conteudo.slice(end);
    const novo = `${before}{{${chave}}}${after}`;
    onChange({ conteudo: novo });
    setVarOpen(false);
    // re-foco no textarea com cursor depois da var
    setTimeout(() => {
      ta.focus();
      const pos = before.length + `{{${chave}}}`.length;
      ta.setSelectionRange(pos, pos);
    }, 0);
  }

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-2 text-xs">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          Caixa selecionada
        </span>

        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => onChange({ bold: !caixa.bold })}
            title="Negrito"
            className={cn(
              "rounded p-1 hover:bg-gray-200",
              caixa.bold && "bg-verde-light text-verde-primary"
            )}
          >
            <Bold className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onChange({ align: "left" })}
            title="Esquerda"
            className={cn(
              "rounded p-1 hover:bg-gray-200",
              caixa.align === "left" && "bg-verde-light text-verde-primary"
            )}
          >
            <AlignLeft className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onChange({ align: "center" })}
            title="Centro"
            className={cn(
              "rounded p-1 hover:bg-gray-200",
              caixa.align === "center" && "bg-verde-light text-verde-primary"
            )}
          >
            <AlignCenter className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onChange({ align: "right" })}
            title="Direita"
            className={cn(
              "rounded p-1 hover:bg-gray-200",
              caixa.align === "right" && "bg-verde-light text-verde-primary"
            )}
          >
            <AlignRight className="size-3.5" />
          </button>

          <span className="mx-0.5 h-5 w-px bg-gray-300" />

          <label className="inline-flex items-center gap-1 rounded p-1">
            <span className="text-[10px] text-gray-600">Tam</span>
            <input
              type="number"
              min={8}
              max={120}
              value={caixa.fontSize ?? 16}
              onChange={(e) =>
                onChange({ fontSize: Math.max(8, Number(e.target.value)) })
              }
              className="w-12 rounded border border-gray-300 px-1 py-0.5 text-xs"
            />
          </label>

          <label className="inline-flex items-center gap-1 rounded p-1">
            <span className="text-[10px] text-gray-600">Larg %</span>
            <input
              type="number"
              min={5}
              max={100}
              value={caixa.w ?? 40}
              onChange={(e) =>
                onChange({ w: Math.max(5, Math.min(100, Number(e.target.value))) })
              }
              className="w-12 rounded border border-gray-300 px-1 py-0.5 text-xs"
            />
          </label>

          <label className="inline-flex items-center gap-1 rounded p-1">
            <span className="text-[10px] text-gray-600">Cor</span>
            <input
              type="color"
              value={caixa.color ?? "#ffffff"}
              onChange={(e) => onChange({ color: e.target.value })}
              className="size-6 cursor-pointer rounded border border-gray-300"
            />
          </label>

          <div ref={varRef} className="relative">
            <button
              type="button"
              onClick={() => setVarOpen((v) => !v)}
              title="Inserir variável"
              className={cn(
                "inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-gray-200",
                varOpen && "bg-verde-light text-verde-primary"
              )}
            >
              <Braces className="size-3.5" />
              <ChevronDown className="size-3" />
            </button>
            {varOpen && (
              <div className="absolute right-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
                <ul className="max-h-60 overflow-auto py-1">
                  {VARIAVEIS.map((v) => (
                    <li key={v.chave}>
                      <button
                        type="button"
                        onClick={() => insertVariavel(v.chave)}
                        className="flex w-full flex-col items-start px-3 py-1.5 text-left hover:bg-verde-light"
                      >
                        <span className="text-xs font-medium text-gray-900">
                          {v.rotulo}
                        </span>
                        <span className="font-mono text-[10px] text-gray-500">
                          {`{{${v.chave}}}`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onRemover}
            title="Remover caixa"
            className="rounded p-1 text-red-alert hover:bg-red-50"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <textarea
        ref={taRef}
        value={caixa.conteudo}
        onChange={(e) => onChange({ conteudo: e.target.value })}
        rows={3}
        placeholder="Texto da caixa (use {{variavel}} para campos dinâmicos)"
        className="w-full resize-none rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
      />

      <p className="mt-1 text-[10px] text-gray-500">
        Posição: {caixa.x.toFixed(1)}% / {caixa.y.toFixed(1)}% · Use o mouse
        sobre a página para arrastar.
      </p>
    </div>
  );
}
