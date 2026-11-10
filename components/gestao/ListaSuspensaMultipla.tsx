"use client";

import { useEffect, useRef, useState } from "react";
import { X, ChevronDown, Check } from "lucide-react";
import { normalizarTexto } from "@/lib/busca/texto";

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#0ea5e9] focus:outline-none focus:ring-1 focus:ring-[#0ea5e9]";

/**
 * Múltipla escolha como lista fechada (ex.: Produtos): as opções só aparecem ao abrir,
 * dá para filtrar digitando, e na caixa ficam apenas as escolhidas (com X para tirar).
 * Veio do formulário (FormularioPublico) em 10/11/2026 para a tarefa da Gestão usar a mesma lista em Produtos;
 * `disabled` mostra só as escolhidas, sem abrir nem tirar.
 */
export default function ListaSuspensaMultipla({ opcoes, valor, onChange, disabled }: {
  opcoes: string[]; valor: string[]; onChange: (v: string[]) => void; disabled?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!aberto) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) { setAberto(false); setBusca(""); }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [aberto]);

  useEffect(() => { if (aberto) buscaRef.current?.focus(); }, [aberto]);

  const q = normalizarTexto(busca);
  const filtradas = q ? opcoes.filter((o) => normalizarTexto(o).includes(q)) : opcoes;
  const alternar = (o: string) => onChange(valor.includes(o) ? valor.filter((x) => x !== o) : [...valor, o]);

  if (opcoes.length === 0) return <p className="text-xs text-gray-400">Sem opções.</p>;
  if (disabled) {
    return (
      <div className={`${inputCls} flex min-h-[38px] flex-wrap items-center gap-1.5 bg-gray-50`}>
        {valor.length === 0 && <span className="text-gray-300">—</span>}
        {valor.map((o) => (
          <span key={o} className="rounded-full bg-[#0ea5e9]/10 px-2 py-0.5 text-xs font-medium text-[#0ea5e9]">{o}</span>
        ))}
      </div>
    );
  }
  return (
    <div ref={wrapRef} className="relative">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAberto((a) => !a); } else if (e.key === "Escape") setAberto(false); }}
        className={`${inputCls} flex min-h-[38px] cursor-pointer items-center gap-2 bg-white`}
      >
        <div className="flex flex-1 flex-wrap gap-1.5">
          {valor.length === 0 && <span className="text-gray-400">Selecione…</span>}
          {valor.map((o) => (
            <span key={o} className="inline-flex items-center gap-1 rounded-full bg-[#0ea5e9]/10 py-0.5 pl-2 pr-1 text-xs font-medium text-[#0ea5e9]">
              {o}
              <button type="button" aria-label={`Remover ${o}`} onClick={(e) => { e.stopPropagation(); alternar(o); }} className="rounded-full p-0.5 hover:bg-[#0ea5e9]/15">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
        <ChevronDown className={`size-4 shrink-0 text-gray-400 transition ${aberto ? "rotate-180" : ""}`} />
      </div>
      {aberto && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-2">
            <input
              ref={buscaRef}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setAberto(false); setBusca(""); }
                else if (e.key === "Enter") { e.preventDefault(); if (filtradas.length === 1) { alternar(filtradas[0]); setBusca(""); } }
              }}
              placeholder="Buscar…"
              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-[#0ea5e9] focus:outline-none"
            />
          </div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtradas.map((o) => {
              const marcado = valor.includes(o);
              return (
                <li key={o}>
                  <button type="button" onClick={() => alternar(o)} className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50 ${marcado ? "font-medium text-[#0ea5e9]" : "text-gray-700"}`}>
                    <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${marcado ? "border-[#0ea5e9] bg-[#0ea5e9] text-white" : "border-gray-300"}`}>
                      {marcado && <Check className="size-3" />}
                    </span>
                    {o}
                  </button>
                </li>
              );
            })}
            {filtradas.length === 0 && <li className="px-3 py-2 text-xs text-gray-400">Nada encontrado.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
