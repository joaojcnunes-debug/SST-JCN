"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { type GestaoCampo } from "@/lib/hooks/useGestao";
import { normalizarTexto, tokenizar } from "@/lib/busca/texto";

const cls = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none disabled:bg-gray-50";

/** Input de edição de um campo personalizado conforme o tipo. */
export default function CampoInput({
  campo,
  value,
  onChange,
  disabled,
}: {
  campo: GestaoCampo;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}) {
  switch (campo.tipo) {
    case "numero":
      return <input type="number" disabled={disabled} value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} className={cls} />;
    case "moeda":
      return (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">R$</span>
          <input type="number" step="0.01" disabled={disabled} value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} className={`${cls} pl-9`} />
        </div>
      );
    case "data":
      return <input type="date" disabled={disabled} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value || null)} className={cls} />;
    case "url":
      return <input type="url" disabled={disabled} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value || null)} placeholder="https://…" className={cls} />;
    case "checkbox":
      return (
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" disabled={disabled} checked={!!value} onChange={(e) => onChange(e.target.checked)} className="size-4 rounded accent-verde-primary" /> Sim
        </label>
      );
    case "selecao":
      return (
        <select disabled={disabled} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value || null)} className={cls}>
          <option value="">—</option>
          {campo.opcoes.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case "multi":
      return <MultiInput opcoes={campo.opcoes} value={value} onChange={onChange} disabled={disabled} />;
    default: // texto
      return <input type="text" disabled={disabled} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value || null)} className={cls} />;
  }
}

/** Texto legível do valor de um campo (cards, lista). */
export function formatarCampoValor(campo: GestaoCampo, value: unknown): string {
  if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) return "—";
  switch (campo.tipo) {
    case "moeda": return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    case "numero": return String(value);
    case "checkbox": return value ? "Sim" : "Não";
    case "data": { const [a, m, d] = String(value).split("-"); return d ? `${d}/${m}/${a}` : String(value); }
    case "multi": return (value as string[]).join(", ");
    default: return String(value);
  }
}

/** "NR - 35", "NR-06"… — as Normas Regulamentadoras ficam num grupo à parte. */
const EH_NR = /^NR\s*-?\s*\d/i;

/**
 * Múltipla escolha em botões. Quando as opções misturam NRs e outros itens (ex.: Produtos do
 * Comercial), vira dois campos lado a lado — NRs e Outros — que mostram só o que está marcado;
 * o "+ Adicionar" abre a lista do grupo com busca. Continua sendo um campo só (as automações
 * leem "Produtos contém…").
 */
function MultiInput({ opcoes, value, onChange, disabled }: {
  opcoes: string[]; value: unknown; onChange: (v: unknown) => void; disabled?: boolean;
}) {
  const arr = Array.isArray(value) ? (value as string[]) : [];
  // O que está marcado na tarefa aparece mesmo que a opção tenha saído da lista do campo
  // (ex.: importado do Runrun) — senão some da tela sem ter sido desmarcado.
  const todas = [...opcoes, ...arr.filter((v) => !opcoes.includes(v))];
  if (todas.length === 0) return <span className="text-xs text-gray-400">Sem opções definidas</span>;

  const nrs = todas.filter((o) => EH_NR.test(o));
  const outros = todas.filter((o) => !EH_NR.test(o));

  if (nrs.length === 0 || outros.length === 0) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {todas.map((o) => {
          const on = arr.includes(o);
          return (
            <button type="button" key={o} disabled={disabled} onClick={() => onChange(on ? arr.filter((x) => x !== o) : [...arr, o])}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${on ? "bg-verde-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {o}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <SeletorGrupo rotulo="NRs" opcoes={nrs} arr={arr} onChange={onChange} disabled={disabled} />
      <SeletorGrupo rotulo="Outros" opcoes={outros} arr={arr} onChange={onChange} disabled={disabled} />
    </div>
  );
}

/** Um grupo do campo: chips dos marcados + lista com busca para marcar/desmarcar. */
function SeletorGrupo({ rotulo, opcoes, arr, onChange, disabled }: {
  rotulo: string; opcoes: string[]; arr: string[]; onChange: (v: unknown) => void; disabled?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false); };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const marcados = opcoes.filter((o) => arr.includes(o));
  const termos = tokenizar(busca);
  const lista = termos.length ? opcoes.filter((o) => { const n = normalizarTexto(o); return termos.every((t) => n.includes(t)); }) : opcoes;
  const alternar = (o: string) => onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]);

  return (
    <div ref={caixa} className="relative rounded-md border border-gray-200 p-2">
      <p className="mb-1.5 text-[11px] font-semibold uppercase text-gray-400">
        {rotulo}{marcados.length > 0 && <span className="ml-1 font-normal normal-case">({marcados.length})</span>}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {marcados.map((o) => (
          <span key={o} className="inline-flex items-center gap-1 rounded-full bg-verde-primary px-2.5 py-1 text-xs font-medium text-white">
            {o}
            {!disabled && (
              <button type="button" onClick={() => alternar(o)} className="text-white/70 hover:text-white" aria-label={`Remover ${o}`}>
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
        {marcados.length === 0 && disabled && <span className="text-xs text-gray-400">—</span>}
        {!disabled && (
          <button type="button" onClick={() => { setAberto((v) => !v); setBusca(""); }}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2.5 py-1 text-xs text-gray-500 hover:border-verde-primary hover:text-verde-primary">
            <Plus className="size-3" /> Adicionar
          </button>
        )}
      </div>
      {aberto && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="relative border-b border-gray-100 p-1.5">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
            <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); setAberto(false); } }}
              placeholder={`Filtrar ${rotulo}…`}
              className="w-full rounded border border-gray-200 py-1 pl-7 pr-2 text-sm focus:border-verde-primary focus:outline-none" />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {lista.map((o) => (
              <li key={o}>
                <label className="flex cursor-pointer items-center gap-2 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50">
                  <input type="checkbox" checked={arr.includes(o)} onChange={() => alternar(o)} className="size-4 rounded accent-verde-primary" />
                  {o}
                </label>
              </li>
            ))}
            {lista.length === 0 && <li className="px-3 py-1.5 text-xs text-gray-400">Nada encontrado.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
