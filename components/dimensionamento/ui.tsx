"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

/* Peças compartilhadas das telas de cadastro do Dimensionamento (DIM-01).
   Vivem aqui, e não num page.tsx, porque arquivo de rota do App Router só deve
   exportar a rota — nesta base um export a mais já reprovou build. */

export function Cabecalho({ titulo, descricao, acao }: { titulo: string; descricao: string; acao?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{titulo}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">{descricao}</p>
      </div>
      {acao}
    </header>
  );
}

export function Carregando() {
  return <div className="rounded-xl bg-white p-10 text-center text-slate-500 shadow-sm ring-1 ring-black/5">Carregando…</div>;
}

export function Vazio({ colSpan, texto }: { colSpan: number; texto: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-slate-500">{texto}</td>
    </tr>
  );
}

export function Campo({ rotulo, ajuda, children }: { rotulo: string; ajuda?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{rotulo}</span>
      {children}
      {ajuda && <span className="mt-1 block text-xs text-slate-500">{ajuda}</span>}
    </label>
  );
}

export function Modal({ titulo, aoFechar, children }: { titulo: string; aoFechar: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={aoFechar}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-slate-900">{titulo}</h2>
          <button type="button" onClick={aoFechar} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="size-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function BotoesModal({ aoCancelar, salvando }: { aoCancelar: () => void; salvando: boolean }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" onClick={aoCancelar} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
        Cancelar
      </button>
      <button type="submit" disabled={salvando} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60">
        {salvando ? "Salvando…" : "Salvar"}
      </button>
    </div>
  );
}
