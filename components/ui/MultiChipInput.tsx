"use client";

import { useId, useState } from "react";
import { X, Plus } from "lucide-react";

/**
 * Entrada de múltiplos valores em "chips": digita livremente OU escolhe das
 * sugestões (datalist). Enter ou "+" adiciona; clicar no × remove.
 */
export default function MultiChipInput({
  value,
  onChange,
  sugestoes = [],
  placeholder,
  ro,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  sugestoes?: string[];
  placeholder?: string;
  ro?: boolean;
}) {
  const [input, setInput] = useState("");
  const listId = useId();

  function add(raw: string) {
    const t = raw.trim();
    if (!t) return;
    if (!value.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...value, t]);
    setInput("");
  }

  const disponiveis = sugestoes.filter(
    (s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()),
  );

  return (
    <div>
      {value.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full bg-verde-light px-2.5 py-0.5 text-xs font-medium text-verde-primary"
            >
              {v}
              {!ro && (
                <button
                  type="button"
                  onClick={() => onChange(value.filter((x) => x !== v))}
                  className="text-verde-primary/60 transition hover:text-red-600"
                  aria-label={`Remover ${v}`}
                >
                  <X className="size-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {!ro && (
        <div className="flex gap-2">
          <input
            list={listId}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(input);
              }
            }}
            placeholder={placeholder}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
          />
          <datalist id={listId}>
            {disponiveis.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <button
            type="button"
            onClick={() => add(input)}
            className="shrink-0 rounded-md border border-gray-300 px-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
            aria-label="Adicionar"
          >
            <Plus className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
