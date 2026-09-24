"use client";

import { RotateCcw, Trash2 } from "lucide-react";

/**
 * Faixa que avisa que existe um preenchimento guardado (ver `useRascunho`).
 *
 * O texto é deliberadamente explícito sobre a idade do rascunho: o que torna
 * isso seguro é o usuário SABER o que está trazendo de volta antes de clicar.
 * Nada é restaurado sozinho.
 */
export default function AvisoRascunho({
  idadeMin,
  onRecuperar,
  onDescartar,
}: {
  idadeMin: number;
  onRecuperar: () => void;
  onDescartar: () => void;
}) {
  const quando =
    idadeMin < 60
      ? `há ${idadeMin} min`
      : `há ${Math.floor(idadeMin / 60)} h${idadeMin % 60 ? ` ${idadeMin % 60} min` : ""}`;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <span className="flex-1 min-w-[180px]">
        Você tinha um preenchimento aqui <strong>{quando}</strong> que não chegou a
        ser salvo.
      </span>
      <button
        type="button"
        onClick={onRecuperar}
        className="inline-flex items-center gap-1 rounded-md border border-amber-400 bg-white px-2 py-1 font-semibold text-amber-900 hover:bg-amber-100"
      >
        <RotateCcw className="size-3" />
        Recuperar
      </button>
      <button
        type="button"
        onClick={onDescartar}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-amber-800/80 hover:text-red-700"
      >
        <Trash2 className="size-3" />
        Descartar
      </button>
    </div>
  );
}
