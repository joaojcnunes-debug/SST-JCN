"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { buscar } from "@/lib/busca/texto";
import AvisoBuscaAproximada from "@/components/ui/AvisoBuscaAproximada";

type Usuario = { nome: string; email: string };

// Combobox de usuário com busca por texto. Controlado: a seleção vive no `value`
// (e-mail) do pai — este componente NUNCA chama `onChange` fora de uma ação
// explícita do usuário (nenhum `useEffect` dispara `onChange`), então um re-render
// de fundo não zera a escolha (lição C13/F1.2). Label = nome, value = e-mail.
export default function UsuarioCombobox({
  usuarios,
  value,
  onChange,
  disabled = false,
  placeholder = "Buscar usuário…",
  incluirVazio = false,
  vazioLabel = "Sem responsável",
  className,
}: {
  usuarios: Usuario[];
  value: string;
  onChange: (email: string) => void;
  disabled?: boolean;
  placeholder?: string;
  incluirVazio?: boolean;
  vazioLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const nomeSel = useMemo(
    () => usuarios.find((u) => u.email.toLowerCase() === value.toLowerCase())?.nome ?? "",
    [usuarios, value],
  );

  const { opcoes, aproximado } = useMemo(() => {
    const q = query.trim();
    // Busca tolerante (acento, ordem das palavras, erro de digitação), ranqueada.
    const r = buscar(usuarios, q, (u) => [u.nome]);
    const base: Usuario[] = incluirVazio && !q ? [{ nome: vazioLabel, email: "" }] : [];
    return { opcoes: [...base, ...r.itens], aproximado: r.aproximado };
  }, [usuarios, query, incluirVazio, vazioLabel]);

  // Fecha ao clicar fora. Só mexe em `open` — nunca em `onChange`.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (open && listRef.current) {
      const el = listRef.current.children[hi] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [hi, open]);

  function abrir() {
    if (disabled) return;
    setQuery("");
    setHi(0);
    setOpen(true);
  }

  function selecionar(email: string) {
    onChange(email);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) { abrir(); return; }
      setHi((h) => Math.min(h + 1, opcoes.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (open && opcoes[hi]) { e.preventDefault(); selecionar(opcoes[hi].email); }
    } else if (e.key === "Escape") {
      if (open) { e.preventDefault(); setOpen(false); }
    }
  }

  const inputCls =
    className ??
    "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30 disabled:bg-gray-50";

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls="usuario-combobox-list"
          aria-autocomplete="list"
          disabled={disabled}
          value={open ? query : nomeSel}
          placeholder={placeholder}
          onFocus={abrir}
          onClick={abrir}
          onChange={(e) => { setQuery(e.target.value); setHi(0); if (!open) setOpen(true); }}
          onKeyDown={onKeyDown}
          className={`${inputCls} pr-8`}
        />
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
      </div>
      {open && (
        <ul
          id="usuario-combobox-list"
          ref={listRef}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          {opcoes.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-400">Nenhum usuário</li>
          )}
          {aproximado && opcoes.length > 0 && (
            <li>
              <AvisoBuscaAproximada aproximado busca={query} total={opcoes.length} compacto />
            </li>
          )}
          {opcoes.map((u, i) => {
            const sel = u.email.toLowerCase() === value.toLowerCase();
            return (
              <li
                key={u.email || "__vazio__"}
                role="option"
                aria-selected={sel}
                onMouseDown={(e) => { e.preventDefault(); selecionar(u.email); }}
                onMouseEnter={() => setHi(i)}
                className={`cursor-pointer px-3 py-1.5 text-sm ${i === hi ? "bg-verde-light/60" : ""} ${sel ? "font-semibold text-verde-primary" : "text-gray-700"} ${!u.email ? "italic text-gray-400" : ""}`}
              >
                {u.nome}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
