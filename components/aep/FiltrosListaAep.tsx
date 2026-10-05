"use client";

// Barra de filtros da lista de Análises e do Dashboard da AEP (2026-10-05).
// A regra fica em lib/aep/filtros-lista.ts.

import { FilterX, Search } from "lucide-react";
import { filtrosListaAtivos, FILTROS_LISTA_VAZIOS, type FiltrosListaAep } from "@/lib/aep/filtros-lista";
import { STATUS_LABEL_AEP, STATUS_ORDEM_AEP } from "@/lib/hooks/useAep";
import type { StatusAEP } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const campo =
  "w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";
const rotulo = "text-[11px] font-medium text-gray-500";

export default function FiltrosListaAep({
  valor,
  onChange,
  responsaveis,
  total,
  mostrando,
}: {
  valor: FiltrosListaAep;
  onChange: (f: FiltrosListaAep) => void;
  /** Nomes de "Realizada por" que existem na lista. */
  responsaveis: string[];
  total: number;
  mostrando: number;
}) {
  const set = (patch: Partial<FiltrosListaAep>) => onChange({ ...valor, ...patch });
  const ativos = filtrosListaAtivos(valor);

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
        <input
          value={valor.busca}
          onChange={(e) => set({ busca: e.target.value })}
          placeholder="Buscar por empresa, CNPJ ou responsável..."
          className={cn(campo, "py-2 pl-8")}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <label className={rotulo}>
          Status
          <select value={valor.status} onChange={(e) => set({ status: e.target.value as "" | StatusAEP })} className={campo}>
            <option value="">Todos</option>
            {STATUS_ORDEM_AEP.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL_AEP[s]}
              </option>
            ))}
          </select>
        </label>
        <label className={rotulo}>
          AET
          <select value={valor.aet} onChange={(e) => set({ aet: e.target.value as FiltrosListaAep["aet"] })} className={campo}>
            <option value="">Todas</option>
            <option value="sim">Requer AET</option>
            <option value="nao">Não requer</option>
          </select>
        </label>
        <label className={rotulo}>
          Nível AIHA (organizacional)
          <select value={valor.nivel} onChange={(e) => set({ nivel: e.target.value })} className={campo}>
            <option value="">Todos</option>
            <option value="altos">Alto ou Muito Alto</option>
            {["Muito Alto", "Alto", "Moderado", "Baixo", "Trivial"].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className={rotulo}>
          Inspeção
          <select
            value={valor.inspecao}
            onChange={(e) => set({ inspecao: e.target.value as FiltrosListaAep["inspecao"] })}
            className={campo}
          >
            <option value="">Todas</option>
            <option value="com">Registrada em inspeção</option>
            <option value="sem">Sem inspeção</option>
          </select>
        </label>
        <label className={rotulo}>
          Realizada por
          <select value={valor.responsavel} onChange={(e) => set({ responsavel: e.target.value })} className={campo}>
            <option value="">Todos</option>
            {responsaveis.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className={rotulo}>
          Elaborada de
          <input type="date" value={valor.de} onChange={(e) => set({ de: e.target.value })} className={campo} />
        </label>
        <label className={rotulo}>
          até
          <input type="date" value={valor.ate} onChange={(e) => set({ ate: e.target.value })} className={campo} />
        </label>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {mostrando} de {total} análise{total !== 1 ? "s" : ""}
        </span>
        {ativos > 0 && (
          <button
            type="button"
            onClick={() => onChange(FILTROS_LISTA_VAZIOS)}
            className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline"
          >
            <FilterX className="size-3.5" /> Limpar filtros ({ativos})
          </button>
        )}
      </div>
    </div>
  );
}
