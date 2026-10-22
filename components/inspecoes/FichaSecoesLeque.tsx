"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SecaoFicha<T extends string> {
  id: T;
  label: string;
}

interface Props<T extends string> {
  /** O que aparece no botão que abre o leque (ícone + texto). */
  gatilho: ReactNode;
  gatilhoClassName?: string;
  secoes: readonly SecaoFicha<T>[];
  selecionadas: Set<T>;
  onChange: (s: Set<T>) => void;
  /** Chamado ao ABRIR o leque — a impressão usa para partir do que está na tela. */
  onAbrir?: () => void;
  /** Conteúdo fixo no pé do leque (ex.: o botão que gera o PDF). */
  rodape?: ReactNode;
  alinhar?: "esquerda" | "direita";
}

/**
 * Leque de seções da Ficha em Branco: um botão que abre a lista com caixas de
 * marcar. "Ficha inteira" marca/desmarca todas; "só esta" deixa uma seção
 * sozinha, que é o uso do dia a dia ("quero ver só os setores").
 */
export default function FichaSecoesLeque<T extends string>({
  gatilho,
  gatilhoClassName,
  secoes,
  selecionadas,
  onChange,
  onAbrir,
  rodape,
  alinhar = "esquerda",
}: Props<T>) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  const todas = selecionadas.size === secoes.length;

  function alternar(id: T) {
    const nova = new Set(selecionadas);
    if (nova.has(id)) nova.delete(id);
    else nova.add(id);
    onChange(nova);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={aberto}
        onClick={() => {
          if (!aberto) onAbrir?.();
          setAberto((v) => !v);
        }}
        className={gatilhoClassName}
      >
        {gatilho}
        <ChevronDown className={cn("size-4 transition-transform", aberto && "rotate-180")} />
      </button>

      {aberto && (
        <div
          className={cn(
            "absolute z-30 mt-1 w-72 rounded-md border border-gray-200 bg-white shadow-lg",
            alinhar === "direita" ? "right-0" : "left-0"
          )}
        >
          <ul className="max-h-96 overflow-auto py-1">
            <li>
              <button
                type="button"
                onClick={() => onChange(todas ? new Set() : new Set(secoes.map((s) => s.id)))}
                className="flex w-full items-center gap-2 border-b border-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-900 hover:bg-verde-light"
              >
                <Caixa marcada={todas} parcial={!todas && selecionadas.size > 0} />
                Ficha inteira
              </button>
            </li>
            {secoes.map((s) => {
              const marcada = selecionadas.has(s.id);
              return (
                <li key={s.id} className="group flex items-center hover:bg-verde-light">
                  <button
                    type="button"
                    onClick={() => alternar(s.id)}
                    className="flex flex-1 items-center gap-2 px-3 py-2 text-left text-sm text-gray-800"
                  >
                    <Caixa marcada={marcada} />
                    {s.label}
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(new Set([s.id]))}
                    className="mr-2 rounded px-1.5 py-0.5 text-xs text-verde-primary opacity-0 hover:underline focus:opacity-100 group-hover:opacity-100"
                  >
                    só esta
                  </button>
                </li>
              );
            })}
          </ul>
          {rodape && <div className="border-t border-gray-100 bg-gray-50 p-2">{rodape}</div>}
        </div>
      )}
    </div>
  );
}

function Caixa({ marcada, parcial }: { marcada: boolean; parcial?: boolean }) {
  return (
    <span
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded border",
        marcada || parcial
          ? "border-verde-primary bg-verde-primary text-white"
          : "border-gray-300 bg-white"
      )}
    >
      {marcada ? <Check className="size-3" /> : parcial ? <span className="h-0.5 w-2 bg-white" /> : null}
    </span>
  );
}
