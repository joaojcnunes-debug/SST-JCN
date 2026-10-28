"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OpcaoSuspensa {
  value: string;
  label: string;
  /** Quantas há com esta opção (aparece entre parênteses). */
  contagem?: number;
  /** Título de seção que aparece ANTES desta opção (ex.: "Situação do documento"). */
  secao?: string;
}

/**
 * Filtro em lista suspensa com várias escolhas (28/10/2026) — mesmo visual do select de
 * "Tempo de espera", mas cada opção tem caixinha, então dá para marcar mais de uma (o cartão
 * "Críticas e urgentes" marca duas). Nada marcado = `rotuloTodos`.
 */
export default function FiltroSuspenso({
  opcoes,
  value,
  onChange,
  rotuloTodos = "Todos",
  className,
  ariaLabel,
}: {
  opcoes: OpcaoSuspensa[];
  value: string[];
  onChange: (v: string[]) => void;
  rotuloTodos?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  const marcadas = opcoes.filter((o) => value.includes(o.value));
  const texto =
    marcadas.length === 0 ? rotuloTodos : marcadas.length <= 2 ? marcadas.map((o) => o.label).join(", ") : `${marcadas.length} selecionadas`;
  const alternar = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-label={ariaLabel}
        onClick={() => setAberto((a) => !a)}
        className={cn(
          "inline-flex min-w-[150px] items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-left text-sm text-gray-900 focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30",
          marcadas.length > 0 && "border-verde-primary",
          className,
        )}
      >
        <span className="truncate">{texto}</span>
        <ChevronDown className="size-4 shrink-0 text-gray-500" />
      </button>
      {aberto && (
        <div role="listbox" aria-multiselectable className="absolute left-0 z-30 mt-1 min-w-full w-max max-w-xs rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={() => onChange([])}
            className={cn("flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50", value.length === 0 && "font-semibold text-verde-primary")}
          >
            <span className="flex size-4 items-center justify-center">{value.length === 0 && <Check className="size-3.5" />}</span>
            {rotuloTodos}
          </button>
          {opcoes.map((o) => {
            const on = value.includes(o.value);
            return (
              <div key={o.value}>
                {o.secao && <p className="mt-1 border-t border-gray-100 px-3 pb-0.5 pt-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-400">{o.secao}</p>}
                <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                  <input type="checkbox" checked={on} onChange={() => alternar(o.value)} className="size-4 rounded border-gray-300 text-verde-primary" />
                  <span className="flex-1">{o.label}</span>
                  {o.contagem !== undefined && <span className="text-xs text-gray-400">({o.contagem})</span>}
                </label>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
