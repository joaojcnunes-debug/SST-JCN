"use client";

import { useEffect, useRef, useState } from "react";
import { X, ChevronDown, Plus } from "lucide-react";

/**
 * Campo ÚNICO (combobox + tags): digita para filtrar/escolher da lista OU
 * adiciona manual quando o texto não existe — tudo no mesmo campo, com chips.
 * Estado controlado pelo pai (selecionados + extras + novoValor), então não muda
 * salvamento nem PDF. Usado na Análise (agravos/medidas) e no Plano de Ação (Como).
 */
export default function ComboTagInline({
  opcoes,
  selecionados,
  extras,
  novoValor,
  onToggle,
  onAdd,
  onRemoveExtra,
  onNovoValor,
  placeholder,
  vazioLabel = "Digite para adicionar um novo item.",
  disabled = false,
  tamanho = "compacto",
}: {
  opcoes: string[];
  selecionados: string[];
  extras: string[];
  novoValor: string;
  onToggle: (item: string) => void;
  onAdd: () => void;
  onRemoveExtra: (i: number) => void;
  onNovoValor: (v: string) => void;
  placeholder: string;
  vazioLabel?: string;
  disabled?: boolean;
  /** "compacto" (padrão) = tamanho de sempre, usado nas tabelas do DRPS.
   *  "normal" = alinhado aos inputs `text-sm` dos modais (EpiForm). */
  tamanho?: "compacto" | "normal";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Os valores de "compacto" são os de sempre — o DRPS não muda em nada.
  const g = tamanho === "normal"
    ? { caixa: "min-h-[42px] px-3 py-1.5", chip: "text-xs", input: "text-sm", item: "text-xs" }
    : { caixa: "min-h-[34px] px-2 py-1",   chip: "text-[10px]", input: "text-[11px]", item: "text-[11px]" };

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const q = novoValor.trim().toLowerCase();
  const norm = (s: string) => s.trim().toLowerCase();
  const filtradas = opcoes
    .filter((o) => !selecionados.includes(o))
    .filter((o) => (q ? norm(o).includes(q) : true));
  const jaExiste =
    opcoes.some((o) => norm(o) === q) ||
    selecionados.some((s) => norm(s) === q) ||
    extras.some((e) => norm(e) === q);

  function escolher(opt: string) {
    if (!selecionados.includes(opt)) onToggle(opt);
    onNovoValor("");
    setOpen(true);
  }

  function adicionar() {
    const v = novoValor.trim();
    if (!v) return;
    // Se já existe na lista, marca em vez de duplicar como manual.
    const match = opcoes.find((o) => norm(o) === norm(v));
    if (match) {
      if (!selecionados.includes(match)) onToggle(match);
      onNovoValor("");
      return;
    }
    onAdd(); // adiciona aos "extras" (manual) e limpa o campo no pai
  }

  return (
    <div ref={ref} className="relative">
      {/* Campo único com chips + input */}
      <div
        onClick={() => !disabled && setOpen(true)}
        className={`flex ${g.caixa} flex-wrap items-center gap-1 rounded-md border ${
          disabled ? "cursor-not-allowed border-gray-200 bg-gray-50" : "cursor-text border-gray-300 bg-white focus-within:border-verde-primary focus-within:ring-1 focus-within:ring-verde-primary/30"
        }`}
      >
        {selecionados.map((s) => (
          <span key={s} className={`inline-flex items-center gap-1 rounded-full bg-verde-light px-2 py-0.5 ${g.chip} text-verde-primary`}>
            {s}
            {!disabled && (
              <button type="button" onClick={(e) => { e.stopPropagation(); onToggle(s); }} className="text-verde-primary/60 hover:text-red-600">
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
        {extras.map((e, i) => (
          <span key={`extra-${i}`} className={`inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 ${g.chip} text-amber-800`}>
            {e}
            {!disabled && (
              <button type="button" onClick={(ev) => { ev.stopPropagation(); onRemoveExtra(i); }} className="text-amber-700/60 hover:text-red-600">
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
        <input
          type="text"
          value={novoValor}
          onChange={(e) => { onNovoValor(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (filtradas.length === 1 && q) escolher(filtradas[0]);
              else adicionar();
            } else if (e.key === "Backspace" && !novoValor) {
              if (extras.length > 0) onRemoveExtra(extras.length - 1);
              else if (selecionados.length > 0) onToggle(selecionados[selecionados.length - 1]);
            }
          }}
          disabled={disabled}
          placeholder={selecionados.length + extras.length === 0 ? placeholder : "Adicionar mais..."}
          className={`min-w-[140px] flex-1 border-0 bg-transparent p-0.5 ${g.input} focus:outline-none disabled:cursor-not-allowed`}
        />
        {!disabled && (
          <ChevronDown
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
            className={`size-3.5 shrink-0 cursor-pointer text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </div>

      {/* Dropdown: opções filtradas + "adicionar manual" */}
      {open && !disabled && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
          <ul className="max-h-56 overflow-auto py-1">
            {filtradas.map((opt) => (
              <li key={opt}>
                <button
                  type="button"
                  onClick={() => escolher(opt)}
                  className={`flex w-full items-center gap-2 px-3 py-1 text-left ${g.item} text-gray-800 hover:bg-verde-light`}
                >
                  <Plus className="size-3 text-verde-primary/70" />
                  {opt}
                </button>
              </li>
            ))}
            {q && !jaExiste && (
              <li>
                <button
                  type="button"
                  onClick={adicionar}
                  className={`flex w-full items-center gap-2 px-3 py-1 text-left ${g.item} font-medium text-amber-800 hover:bg-amber-50`}
                >
                  <Plus className="size-3" />
                  Adicionar “{novoValor.trim()}”
                </button>
              </li>
            )}
            {filtradas.length === 0 && (!q || jaExiste) && (
              <li className={`px-3 py-2 ${g.item} text-gray-400`}>
                {jaExiste ? "Já adicionado." : vazioLabel}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
