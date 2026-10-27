"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, ChevronDown, Search, X } from "lucide-react";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { buscarEmpresas, fantasiaDistinto } from "@/lib/busca/empresas";
import { useGruposEmpresas } from "@/lib/hooks/useGruposEmpresas";
import SeloGrupo from "@/components/empresas/SeloGrupo";
import AvisoBuscaAproximada from "@/components/ui/AvisoBuscaAproximada";
import { cn, formatCNPJ } from "@/lib/utils";

/** Mesmo teto do EmpresaSelect: a busca cobre a lista inteira, só a exibição é cortada. */
const MAX_OPCOES = 50;

/**
 * Escolha de VÁRIAS empresas (Consolidação por empresa, 27/10/2026). Mesma busca do
 * EmpresaSelect — acento, CNPJ sem máscara e nome do grupo — com caixa de marcar em
 * cada uma e "Marcar as N da busca" para trazer um grupo inteiro de uma vez.
 */
export default function EmpresasMultiSelect({
  value,
  onChange,
  placeholder = "Selecione as empresas...",
  className,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const { data: empresas = [], isLoading } = useEmpresas();
  const { porEmpresa: grupoDaEmpresa, nomeGrupoDe } = useGruposEmpresas();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const marcadas = useMemo(() => new Set(value), [value]);
  const selecionadas = useMemo(() => empresas.filter((e) => marcadas.has(e.id_empresa)), [empresas, marcadas]);

  const { itens: filtradas, aproximado } = useMemo(
    () => buscarEmpresas(empresas, query, { grupoDe: (e: { id_empresa: string }) => nomeGrupoDe(e.id_empresa) }),
    [empresas, query, nomeGrupoDe],
  );
  const exibidas = filtradas.slice(0, MAX_OPCOES);
  const ocultas = Math.max(0, filtradas.length - MAX_OPCOES);
  const naoMarcadasDaBusca = query.trim() ? filtradas.filter((e) => !marcadas.has(e.id_empresa)) : [];

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const alternar = (id: string) =>
    onChange(marcadas.has(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
      >
        <span className="flex items-center gap-2 truncate">
          <Building2 className="size-4 shrink-0 text-gray-400" />
          {value.length ? (
            <span className="font-medium">
              {value.length} {value.length === 1 ? "empresa selecionada" : "empresas selecionadas"}
            </span>
          ) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-gray-400 transition-transform", open && "rotate-180")} />
      </button>

      {selecionadas.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selecionadas.map((e) => (
            <span
              key={e.id_empresa}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-verde-light px-2 py-0.5 text-xs text-gray-800"
            >
              <span className="truncate">{e.nome_empresa}</span>
              <button
                type="button"
                onClick={() => alternar(e.id_empresa)}
                className="rounded-full p-0.5 text-gray-500 hover:bg-white hover:text-gray-800"
                aria-label={`Tirar ${e.nome_empresa}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <button type="button" onClick={() => onChange([])} className="text-xs text-gray-500 underline hover:text-gray-700">
            limpar
          </button>
        </div>
      )}

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="space-y-1.5 border-b border-gray-100 p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome, fantasia, CNPJ ou grupo..."
                className="w-full rounded-md border border-gray-200 py-1.5 pl-8 pr-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
              />
            </div>
            {naoMarcadasDaBusca.length > 1 && naoMarcadasDaBusca.length <= MAX_OPCOES && (
              <button
                type="button"
                onClick={() => onChange([...value, ...naoMarcadasDaBusca.map((e) => e.id_empresa)])}
                className="text-xs font-medium text-verde-primary hover:underline"
              >
                Marcar as {naoMarcadasDaBusca.length} da busca
              </button>
            )}
          </div>
          <ul className="max-h-72 overflow-auto py-1">
            {isLoading && <li className="px-3 py-2 text-sm text-gray-500">Carregando...</li>}
            {!isLoading && filtradas.length === 0 && <li className="px-3 py-2 text-sm text-gray-500">Nenhuma empresa encontrada</li>}
            {!isLoading && aproximado && filtradas.length > 0 && (
              <li>
                <AvisoBuscaAproximada aproximado busca={query} total={filtradas.length} compacto />
              </li>
            )}
            {exibidas.map((e) => (
              <li key={e.id_empresa}>
                <label
                  className={cn(
                    "flex w-full cursor-pointer items-start gap-2 px-3 py-2 text-left text-sm hover:bg-verde-light",
                    marcadas.has(e.id_empresa) && "bg-verde-light/60",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={marcadas.has(e.id_empresa)}
                    onChange={() => alternar(e.id_empresa)}
                    className="mt-0.5 size-4 shrink-0 rounded border-gray-300 text-verde-primary"
                  />
                  <span className="min-w-0">
                    <span className="block font-medium text-gray-900">{e.nome_empresa}</span>
                    {(fantasiaDistinto(e) || e.cnpj || grupoDaEmpresa.has(e.id_empresa)) && (
                      <span className="flex max-w-full flex-wrap items-center gap-1.5 text-xs text-gray-500">
                        {fantasiaDistinto(e) && <span className="text-gray-600">{fantasiaDistinto(e)}</span>}
                        {fantasiaDistinto(e) && e.cnpj && <span aria-hidden>·</span>}
                        {e.cnpj && formatCNPJ(e.cnpj)}
                        <SeloGrupo info={grupoDaEmpresa.get(e.id_empresa)} compacto />
                      </span>
                    )}
                  </span>
                </label>
              </li>
            ))}
            {!isLoading && ocultas > 0 && (
              <li className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500">
                Mostrando {MAX_OPCOES} de {filtradas.length} empresas. Refine a busca para ver as outras {ocultas}.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
