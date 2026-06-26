"use client";

import { type GestaoCampo } from "@/lib/hooks/useGestao";

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
    case "multi": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="flex flex-wrap gap-1.5">
          {campo.opcoes.map((o) => {
            const on = arr.includes(o);
            return (
              <button type="button" key={o} disabled={disabled} onClick={() => onChange(on ? arr.filter((x) => x !== o) : [...arr, o])}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${on ? "bg-verde-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {o}
              </button>
            );
          })}
          {campo.opcoes.length === 0 && <span className="text-xs text-gray-400">Sem opções definidas</span>}
        </div>
      );
    }
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
