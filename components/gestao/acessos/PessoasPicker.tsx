"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PessoaOpcao { email: string; nome: string; perfil: string }

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Escolha de VÁRIAS pessoas (v305): busca por nome ou e-mail (sem acento), filtro por perfil,
 * "Marcar as N da busca" e as escolhidas como etiquetas. Antes era um select de uma pessoa só.
 */
export default function PessoasPicker({
  pessoas,
  value,
  onChange,
  excluir,
}: {
  pessoas: PessoaOpcao[];
  value: string[];
  onChange: (emails: string[]) => void;
  /** E-mails que não podem ser escolhidos (ex.: já são da equipe). */
  excluir?: Set<string>;
}) {
  const [busca, setBusca] = useState("");
  const [perfil, setPerfil] = useState("");
  const marcados = useMemo(() => new Set(value.map((e) => e.toLowerCase())), [value]);
  const perfis = useMemo(() => [...new Set(pessoas.map((p) => p.perfil).filter(Boolean))].sort(), [pessoas]);

  const lista = useMemo(() => {
    const q = norm(busca.trim());
    return pessoas.filter(
      (p) =>
        !excluir?.has(p.email.toLowerCase()) &&
        (!perfil || p.perfil === perfil) &&
        (!q || norm(p.nome).includes(q) || norm(p.email).includes(q)),
    );
  }, [pessoas, busca, perfil, excluir]);
  const naoMarcadas = lista.filter((p) => !marcados.has(p.email.toLowerCase()));
  const nomeDe = useMemo(() => new Map(pessoas.map((p) => [p.email.toLowerCase(), p.nome])), [pessoas]);

  const alternar = (email: string) =>
    onChange(marcados.has(email.toLowerCase()) ? value.filter((e) => e.toLowerCase() !== email.toLowerCase()) : [...value, email]);

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar pessoa por nome ou e-mail…"
            className="w-full rounded-md border border-gray-200 py-1 pl-7 pr-2 text-sm focus:border-verde-primary focus:outline-none"
          />
        </div>
        <select value={perfil} onChange={(e) => setPerfil(e.target.value)} className="rounded-md border border-gray-200 px-2 py-1 text-sm" aria-label="Filtrar por perfil">
          <option value="">Todos os perfis</option>
          {perfis.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>
      <div className="max-h-40 overflow-auto rounded-md border border-gray-200 bg-white p-1">
        {naoMarcadas.length > 1 && (busca.trim() || perfil) && (
          <button type="button" onClick={() => onChange([...value, ...naoMarcadas.map((p) => p.email)])} className="px-1.5 py-0.5 text-[11px] font-medium text-verde-primary hover:underline">
            Marcar as {naoMarcadas.length} da busca
          </button>
        )}
        {lista.map((p) => (
          <label key={p.email} className={cn("flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-gray-50", marcados.has(p.email.toLowerCase()) && "bg-verde-light/60")}>
            <input type="checkbox" checked={marcados.has(p.email.toLowerCase())} onChange={() => alternar(p.email)} className="size-3.5 rounded border-gray-300 text-verde-primary" />
            <span className="min-w-0 flex-1 truncate">
              {p.nome} <span className="text-[11px] text-gray-400">{p.email}</span>
            </span>
            <span className="shrink-0 text-[10px] text-gray-400">{p.perfil}</span>
          </label>
        ))}
        {lista.length === 0 && <p className="px-2 py-3 text-center text-xs text-gray-400">Ninguém encontrado.</p>}
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {value.map((e) => (
            <span key={e} className="inline-flex items-center gap-1 rounded-full bg-verde-light px-2 py-0.5 text-[11px] text-gray-800">
              {nomeDe.get(e.toLowerCase()) ?? e}
              <button type="button" onClick={() => alternar(e)} aria-label={`Tirar ${e}`} className="text-gray-500 hover:text-gray-800">
                <X className="size-3" />
              </button>
            </span>
          ))}
          <button type="button" onClick={() => onChange([])} className="text-[11px] text-gray-400 underline">limpar</button>
        </div>
      )}
    </div>
  );
}
