"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { normalizarTexto } from "@/lib/busca/texto";
import { cn } from "@/lib/utils";

/**
 * Lista de opções no tom verde do painel. O <select> nativo abre com o destaque azul do sistema;
 * esta abre num cartão arredondado, com o escolhido no verde do botão "Nova tarefa".
 * `busca`: campo "Buscar…" no topo (listas longas, ex.: responsáveis).
 */
export default function SelectVerde<T extends string>({
  valor,
  opcoes,
  onChange,
  desabilitado = false,
  busca = false,
  placeholderBusca = "Buscar…",
  className,
  larguraLista,
}: {
  valor: T;
  opcoes: { value: T; label: string }[];
  onChange: (v: T) => void;
  desabilitado?: boolean;
  busca?: boolean;
  placeholderBusca?: string;
  /** Classes da caixa (tamanho/largura); o padrão ocupa a largura toda. */
  className?: string;
  /** Classes de largura da lista aberta (padrão: a da caixa). */
  larguraLista?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora ou com Esc.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) { setAberto(false); setTermo(""); } };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setAberto(false); setTermo(""); } };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);

  const q = normalizarTexto(termo);
  const visiveis = q ? opcoes.filter((o) => normalizarTexto(o.label).includes(q)) : opcoes;
  const atual = opcoes.find((o) => o.value === valor);
  const escolher = (v: T) => { onChange(v); setAberto(false); setTermo(""); };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        disabled={desabilitado}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-1.5 text-left text-sm font-medium text-gray-700 transition disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400",
          aberto ? "border-verde-primary ring-1 ring-verde-primary" : "border-gray-200 hover:border-verde-primary/60",
          className,
        )}
      >
        <span className="truncate">{atual?.label ?? "—"}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-gray-400 transition", aberto && "rotate-180")} />
      </button>
      {aberto && (
        <div className={cn("absolute left-0 z-50 mt-1 min-w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg", larguraLista)}>
          {busca && (
            <div className="border-b border-gray-100 p-2">
              <input
                autoFocus
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
                placeholder={placeholderBusca}
                className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-verde-primary focus:outline-none"
              />
            </div>
          )}
          <ul role="listbox" className="max-h-56 overflow-y-auto p-1">
            {visiveis.map((o) => {
              const sel = o.value === valor;
              return (
                <li key={o.value || "__vazio__"}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={sel}
                    onClick={() => escolher(o.value)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-left text-sm transition",
                      sel ? "bg-verde-primary font-medium text-white" : "text-gray-700 hover:bg-verde-light/60 hover:text-verde-primary",
                    )}
                  >
                    {o.label}
                    {sel && <Check className="size-3.5 shrink-0" />}
                  </button>
                </li>
              );
            })}
            {visiveis.length === 0 && <li className="px-2.5 py-1.5 text-xs text-gray-400">Nada encontrado.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
