"use client";

import { Plus, Trash2 } from "lucide-react";
import type { OperadorFicha } from "@/lib/supabase/types";

const inputClass =
  "w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-gray-50 disabled:text-gray-500";

/**
 * Operadores/responsáveis de uma máquina — lista de {nome, cargo}.
 *
 * Nome ocupa o dobro do cargo (2:1) com `min-w-0` nos dois: sem isso o input
 * flex estoura o container em nomes longos em vez de encolher.
 *
 * Sai no PDF como "Nome — Cargo; Nome — Cargo".
 */
export default function OperadoresEditor({
  valor,
  onChange,
  disabled = false,
}: {
  valor: OperadorFicha[] | null;
  onChange: (v: OperadorFicha[] | null) => void;
  disabled?: boolean;
}) {
  const lista = valor ?? [];

  function atualizar(i: number, campo: keyof OperadorFicha, texto: string) {
    const nova = lista.map((op, idx) => (idx === i ? { ...op, [campo]: texto } : op));
    onChange(nova);
  }

  function remover(i: number) {
    const nova = lista.filter((_, idx) => idx !== i);
    onChange(nova.length ? nova : null);
  }

  return (
    <div className="space-y-1.5">
      {lista.length === 0 && (
        <p className="text-[10px] italic text-gray-400">
          Nenhum operador informado — a linha não sai no laudo.
        </p>
      )}

      {lista.map((op, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="min-w-0 flex-[2]">
            <input
              type="text"
              value={op.nome ?? ""}
              onChange={(e) => atualizar(i, "nome", e.target.value)}
              disabled={disabled}
              placeholder="Nome"
              className={inputClass}
            />
          </div>
          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={op.cargo ?? ""}
              onChange={(e) => atualizar(i, "cargo", e.target.value)}
              disabled={disabled}
              placeholder="Cargo"
              className={inputClass}
            />
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => remover(i)}
              title="Remover operador"
              className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      ))}

      {!disabled && (
        <button
          type="button"
          onClick={() => onChange([...lista, { nome: "", cargo: "" }])}
          className="inline-flex items-center gap-1 rounded border border-dashed border-gray-300 px-2 py-0.5 text-[10px] font-semibold text-gray-600 hover:bg-gray-50"
        >
          <Plus className="size-3" /> Adicionar operador
        </button>
      )}
    </div>
  );
}
