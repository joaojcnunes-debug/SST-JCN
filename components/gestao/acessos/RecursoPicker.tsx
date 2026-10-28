"use client";

import { useMemo, useState } from "react";
import { Folder, LayoutGrid, List, Search } from "lucide-react";
import { chaveRecurso, ehGrupoSemEspaco, filtrarArvore, type NoEspaco, type TipoRecurso } from "@/lib/gestao/acessos";
import { cn } from "@/lib/utils";

/**
 * Onde dar acesso (v305): árvore Espaço › Pasta › Lista com busca. Marcar um ESPAÇO ou uma PASTA
 * grava o acesso nele — vale para as listas que estão lá e para as que forem criadas depois (o
 * banco resolve lista > pasta > espaço). As listas cobertas por um espaço/pasta marcado aparecem
 * esmaecidas, com o aviso de que já estão incluídas.
 */
export default function RecursoPicker({
  arvore,
  value,
  onChange,
  altura = "max-h-56",
}: {
  arvore: NoEspaco[];
  value: Set<string>;
  onChange: (v: Set<string>) => void;
  altura?: string;
}) {
  const [busca, setBusca] = useState("");
  const visivel = useMemo(() => filtrarArvore(arvore, busca), [arvore, busca]);

  const alternar = (tipo: TipoRecurso, id: string) => {
    const k = chaveRecurso(tipo, id);
    const n = new Set(value);
    if (n.has(k)) n.delete(k);
    else n.add(k);
    onChange(n);
  };

  const item = (tipo: TipoRecurso, id: string, nome: string, nivel: number, coberto: boolean) => {
    const marcado = value.has(chaveRecurso(tipo, id));
    const Icone = tipo === "space" ? LayoutGrid : tipo === "folder" ? Folder : List;
    return (
      <label
        key={`${tipo}:${id}`}
        className={cn(
          "flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-gray-50",
          marcado && "bg-verde-light/60",
          coberto && !marcado && "opacity-50",
        )}
        style={{ paddingLeft: `${0.375 + nivel * 1.1}rem` }}
        title={coberto && !marcado ? "Já incluída pelo espaço ou pasta marcado acima" : undefined}
      >
        <input type="checkbox" checked={marcado} onChange={() => alternar(tipo, id)} className="size-3.5 rounded border-gray-300 text-verde-primary" />
        <Icone className={cn("size-3.5 shrink-0", tipo === "list" ? "text-gray-400" : "text-verde-primary")} />
        <span className={cn("truncate", tipo !== "list" && "font-medium text-gray-800")}>{nome}</span>
        {tipo !== "list" && <span className="shrink-0 text-[10px] text-gray-400">{tipo === "space" ? "espaço inteiro" : "pasta inteira"}</span>}
        {coberto && !marcado && <span className="shrink-0 text-[10px] text-gray-400">incluída</span>}
      </label>
    );
  };

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar espaço, pasta ou lista…"
          className="w-full rounded-md border border-gray-200 py-1 pl-7 pr-2 text-sm focus:border-verde-primary focus:outline-none"
        />
      </div>
      <div className={cn("overflow-auto rounded-md border border-gray-200 bg-white p-1", altura)}>
        {visivel.length === 0 && <p className="px-2 py-3 text-center text-xs text-gray-400">Nada encontrado.</p>}
        {visivel.map((e) => {
          const semEsp = ehGrupoSemEspaco(e);
          const espMarcado = !semEsp && value.has(chaveRecurso("space", e.id));
          return (
            <div key={e.id}>
              {semEsp ? (
                <p className="px-1.5 pb-0.5 pt-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-400">{e.nome}</p>
              ) : (
                item("space", e.id, e.nome, 0, false)
              )}
              {e.pastas.map((p) => {
                const pastaMarcada = value.has(chaveRecurso("folder", p.id));
                return (
                  <div key={p.id}>
                    {item("folder", p.id, p.nome, 1, espMarcado)}
                    {p.listas.map((l) => item("list", l.id, l.nome, 2, espMarcado || pastaMarcada))}
                  </div>
                );
              })}
              {e.listas.map((l) => item("list", l.id, l.nome, semEsp ? 0 : 1, espMarcado))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
