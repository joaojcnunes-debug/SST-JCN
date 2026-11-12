"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CalendarX } from "lucide-react";
import { atalhosData, isoLocal } from "@/lib/gestao/datas-rapidas";
import type { GestaoEtiqueta, GestaoTarefa } from "@/lib/hooks/useGestao";

/**
 * Caixinha aberta pelos atalhos D (prazo) e L (etiquetas) sobre o cartão (v0.3.922, como no Trello).
 * Prazo grava e fecha; etiqueta grava a cada clique e fica aberta. Esc ou clique fora fecha.
 */
export default function AtalhoPopover({
  tipo, tarefa, x, y, etiquetas, onFechar, onPrazo, onEtiquetas,
}: {
  tipo: "prazo" | "etiqueta";
  tarefa: GestaoTarefa;
  x: number;
  y: number;
  etiquetas: GestaoEtiqueta[];
  onFechar: () => void;
  onPrazo: (iso: string | null) => void;
  onEtiquetas: (lista: string[]) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [marcadas, setMarcadas] = useState<string[]>(tarefa.etiquetas ?? []);
  const [data, setData] = useState(tarefa.prazo ?? "");

  useEffect(() => {
    const fora = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onFechar(); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onFechar(); } };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc, true);
    ref.current?.querySelector<HTMLElement>("button, input")?.focus();
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc, true); };
  }, [onFechar]);

  const largura = 256;
  const left = typeof window === "undefined" ? x : Math.max(8, Math.min(x, window.innerWidth - largura - 8));
  const top = typeof window === "undefined" ? y : Math.max(8, Math.min(y, window.innerHeight - 320));
  const botao = "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none";

  function alternar(nome: string) {
    const nova = marcadas.includes(nome) ? marcadas.filter((e) => e !== nome) : [...marcadas, nome];
    setMarcadas(nova);
    onEtiquetas(nova);
  }

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={tipo === "prazo" ? "Mudar o prazo" : "Marcar etiquetas"}
      style={{ left, top, width: largura }}
      className="fixed z-50 rounded-lg border border-gray-200 bg-white p-2 shadow-xl"
    >
      <p className="truncate px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400" title={tarefa.titulo}>
        {tipo === "prazo" ? "Prazo" : "Etiquetas"} · {tarefa.titulo}
      </p>
      {tipo === "prazo" ? (
        <div className="space-y-0.5">
          {atalhosData(isoLocal(new Date())).map((a) => (
            <button key={a.rotulo} type="button" role="menuitem" onClick={() => onPrazo(a.data)} className={botao}>
              <span>{a.rotulo}</span>
              <span className="text-xs text-gray-400">{a.data.split("-").reverse().slice(0, 2).join("/")}</span>
            </button>
          ))}
          <div className="flex items-center gap-1.5 px-2 pt-1">
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} aria-label="Outra data" className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-marca-primary focus:outline-none" />
            <button type="button" disabled={!data} onClick={() => onPrazo(data)} className="rounded-md bg-marca-primary px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50">OK</button>
          </div>
          {tarefa.prazo && (
            <button type="button" role="menuitem" onClick={() => onPrazo(null)} className={`${botao} mt-1 text-gray-500`}>
              <span className="inline-flex items-center gap-1.5"><CalendarX className="size-4" /> Tirar o prazo</span>
            </button>
          )}
        </div>
      ) : etiquetas.length === 0 ? (
        <p className="px-2 py-2 text-sm text-gray-500">Este quadro ainda não tem etiquetas cadastradas.</p>
      ) : (
        <div className="max-h-64 space-y-0.5 overflow-y-auto">
          {etiquetas.map((e) => {
            const on = marcadas.includes(e.nome);
            return (
              <button key={e.id} type="button" role="menuitemcheckbox" aria-checked={on} onClick={() => alternar(e.nome)} className={botao}>
                <span className="inline-flex min-w-0 items-center gap-2">
                  <span className="size-3 shrink-0 rounded-sm" style={{ background: e.cor || "var(--surface-3)" }} aria-hidden />
                  <span className="truncate">{e.nome}</span>
                </span>
                {on && <Check className="size-4 shrink-0 text-marca-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
