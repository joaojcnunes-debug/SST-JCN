"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { norm } from "./PessoasPicker";
import { cn } from "@/lib/utils";

export interface OpcaoBusca {
  id: string;
  titulo: string;
  sub?: string;
  /** Etiqueta à direita (ex.: "fora da Gestão"). */
  marca?: string;
  marcaCls?: string;
}

/**
 * Escolha de UMA opção com busca (v0.3.851) — no lugar do select nativo de "Por pessoa" e "Por
 * lista". Mesma busca do "Dar acesso": digita parte do nome, e-mail ou caminho, sem acento.
 * Escolhida, vira um cartão com "Trocar".
 */
export default function BuscaUnica({
  opcoes,
  value,
  onChange,
  placeholder,
  filtros,
}: {
  opcoes: OpcaoBusca[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  /** Filtros extras ao lado da busca (ex.: perfil). */
  filtros?: ReactNode;
}) {
  const [busca, setBusca] = useState("");
  const escolhida = useMemo(() => opcoes.find((o) => o.id === value), [opcoes, value]);
  const lista = useMemo(() => {
    const q = norm(busca.trim());
    return q ? opcoes.filter((o) => norm(`${o.titulo} ${o.sub ?? ""}`).includes(q)) : opcoes;
  }, [opcoes, busca]);

  const escolher = (id: string) => {
    onChange(id);
    setBusca("");
  };

  if (value && escolhida) {
    return (
      <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-md border border-verde-primary/40 bg-verde-light/40 px-2.5 py-1.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-800">{escolhida.titulo}</p>
          {escolhida.sub && <p className="truncate text-[11px] text-gray-500">{escolhida.sub}</p>}
        </div>
        {escolhida.marca && <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium", escolhida.marcaCls)}>{escolhida.marca}</span>}
        <button type="button" onClick={() => onChange("")} className="inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-verde-primary hover:bg-white">
          <X className="size-3" /> Trocar
        </button>
      </div>
    );
  }

  return (
    <div className="min-w-[260px] flex-1 space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
          <input
            autoFocus
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && lista.length > 0) escolher(lista[0].id);
            }}
            placeholder={placeholder}
            className="w-full rounded-md border border-gray-200 py-1.5 pl-7 pr-2 text-sm focus:border-verde-primary focus:outline-none"
          />
        </div>
        {filtros}
      </div>
      <div className="max-h-56 overflow-auto rounded-md border border-gray-200 bg-white p-1">
        {lista.map((o) => (
          <button key={o.id} type="button" onClick={() => escolher(o.id)} className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-sm hover:bg-gray-50">
            <span className="min-w-0 flex-1 truncate">
              {o.titulo} {o.sub && <span className="text-[11px] text-gray-400">{o.sub}</span>}
            </span>
            {o.marca && <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium", o.marcaCls)}>{o.marca}</span>}
          </button>
        ))}
        {lista.length === 0 && <p className="px-2 py-3 text-center text-xs text-gray-400">Nada encontrado.</p>}
      </div>
    </div>
  );
}
