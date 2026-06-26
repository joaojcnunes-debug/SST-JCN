"use client";

import { X, Trash2 } from "lucide-react";
import { PRIORIDADES, type GestaoStatus, type GestaoEtiqueta } from "@/lib/hooks/useGestao";

const sel = "rounded-md border border-white/20 bg-white/10 px-2 py-1 text-sm text-white focus:outline-none [&>option]:text-gray-800";

export default function BarraAcoesMassa({
  count,
  statuses,
  usuarios,
  etiquetas,
  onStatus,
  onResponsavel,
  onPrioridade,
  onEtiqueta,
  onExcluir,
  onCancelar,
}: {
  count: number;
  statuses: GestaoStatus[];
  usuarios: string[];
  etiquetas: GestaoEtiqueta[];
  onStatus: (slug: string) => void;
  onResponsavel: (nome: string | null) => void;
  onPrioridade: (p: string) => void;
  onEtiqueta: (nome: string) => void;
  onExcluir: () => void;
  onCancelar: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 print:hidden">
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-white shadow-2xl ring-1 ring-black/10">
        <span className="rounded-md bg-white/15 px-2 py-1 text-sm font-semibold">{count} selecionada{count > 1 ? "s" : ""}</span>

        <select value="" onChange={(e) => e.target.value && onStatus(e.target.value)} className={sel}>
          <option value="">Mover para…</option>
          {statuses.map((s) => <option key={s.slug} value={s.slug}>{s.nome}</option>)}
        </select>

        <select value="" onChange={(e) => onResponsavel(e.target.value === "__none__" ? null : e.target.value || null)} className={sel}>
          <option value="">Responsável…</option>
          <option value="__none__">Sem responsável</option>
          {usuarios.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>

        <select value="" onChange={(e) => e.target.value && onPrioridade(e.target.value)} className={sel}>
          <option value="">Prioridade…</option>
          {PRIORIDADES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>

        {etiquetas.length > 0 && (
          <select value="" onChange={(e) => e.target.value && onEtiqueta(e.target.value)} className={sel}>
            <option value="">+ Etiqueta…</option>
            {etiquetas.map((et) => <option key={et.id} value={et.nome}>{et.nome}</option>)}
          </select>
        )}

        <button type="button" onClick={onExcluir} className="inline-flex items-center gap-1 rounded-md bg-red-500/90 px-2.5 py-1 text-sm font-medium hover:bg-red-500">
          <Trash2 className="size-3.5" /> Excluir
        </button>

        <button type="button" onClick={onCancelar} title="Cancelar seleção" className="rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
