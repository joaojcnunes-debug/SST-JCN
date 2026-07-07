"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { ChevronDown, Search, X, Building2 } from "lucide-react";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { cn, formatCNPJ } from "@/lib/utils";
import type { ModuloEmpresa } from "@/lib/supabase/types";

interface EmpresaSelectProps {
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Quando informado, filtra apenas empresas habilitadas neste módulo. */
  modulo?: ModuloEmpresa;
  /** Ignora o filtro de módulo e exibe todas as empresas. */
  allowAll?: boolean;
  /** Quando informado (Unidade ativa), limita o dropdown às empresas da unidade. */
  unidadeId?: string | null;
}

export default function EmpresaSelect({
  value,
  onChange,
  placeholder = "Selecione uma empresa...",
  className,
  disabled,
  modulo,
  allowAll,
  unidadeId,
}: EmpresaSelectProps) {
  const { data: empresas = [], isLoading } = useEmpresas(allowAll ? undefined : modulo);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => empresas.find((e) => e.id_empresa === value) ?? null,
    [empresas, value]
  );

  const filtered = useMemo(() => {
    // Escopo por Unidade ativa: só empresas da unidade.
    const base = unidadeId ? empresas.filter((e) => e.id_unidade === unidadeId) : empresas;
    if (!query.trim()) return base;
    const q = query.toLowerCase();
    return base.filter(
      (e) =>
        e.nome_empresa.toLowerCase().includes(q) ||
        (e.cnpj ?? "").toLowerCase().includes(q) ||
        (e.razao_social ?? "").toLowerCase().includes(q)
    );
  }, [empresas, query, unidadeId]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={cn(
          "flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm",
          "focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30",
          disabled && "opacity-60 cursor-not-allowed"
        )}
      >
        <span className="flex items-center gap-2 truncate">
          <Building2 className="size-4 text-gray-400 shrink-0" />
          {selected ? (
            <span className="truncate">
              <span className="font-medium">{selected.nome_empresa}</span>
              {selected.cnpj && (
                <span className="ml-2 text-xs text-gray-500">
                  {formatCNPJ(selected.cnpj)}
                </span>
              )}
            </span>
          ) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {selected && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
                setQuery("");
              }}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
              aria-label="Limpar"
            >
              <X className="size-3.5" />
            </span>
          )}
          <ChevronDown
            className={cn(
              "size-4 text-gray-400 transition-transform",
              open && "rotate-180"
            )}
          />
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome ou CNPJ..."
                className="w-full rounded-md border border-gray-200 py-1.5 pl-8 pr-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
              />
            </div>
          </div>
          <ul className="max-h-64 overflow-auto py-1">
            {isLoading && (
              <li className="px-3 py-2 text-sm text-gray-500">Carregando...</li>
            )}
            {!isLoading && filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-500">
                Nenhuma empresa encontrada
              </li>
            )}
            {filtered.map((e) => (
              <li key={e.id_empresa}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(e.id_empresa);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-verde-light",
                    value === e.id_empresa && "bg-verde-light"
                  )}
                >
                  <span className="font-medium text-gray-900">
                    {e.nome_empresa}
                  </span>
                  {e.cnpj && (
                    <span className="text-xs text-gray-500">
                      {formatCNPJ(e.cnpj)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
