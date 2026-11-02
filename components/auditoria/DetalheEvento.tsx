"use client";

// O detalhe de um evento da trilha (v212): campo | antes | depois numa edição;
// a linha inteira, sem os vazios, numa criação ou exclusão. Usado pela tela
// Sistema › Auditoria e pela aba Histórico dos documentos (v259).

import { useState } from "react";
import { formatarValor, rotuloCampo } from "@/lib/auditoria/eventos";
import type { AuditoriaAcao, AuditoriaEvento } from "@/lib/supabase/types";

export const ACAO_CORES: Record<AuditoriaAcao, string> = {
  criou: "bg-emerald-100 text-emerald-700",
  editou: "bg-amber-100 text-amber-700",
  excluiu: "bg-red-100 text-red-700",
};

export function DetalheEvento({ ev }: { ev: AuditoriaEvento }) {
  const [tudo, setTudo] = useState(false);
  if (ev.acao === "editou") {
    return (
      <div className="mx-3 mb-3 overflow-x-auto rounded-md border border-gray-200">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-2 py-1.5">Campo</th>
              <th className="px-2 py-1.5">Antes</th>
              <th className="px-2 py-1.5">Depois</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ev.campos_alterados.map((c) => (
              <tr key={c} className="align-top">
                <td className="whitespace-nowrap px-2 py-1.5 font-medium text-gray-700">{rotuloCampo(c)}</td>
                <td className="max-w-[24rem] break-words px-2 py-1.5 text-red-700"><Valor v={ev.antes?.[c]} /></td>
                <td className="max-w-[24rem] break-words px-2 py-1.5 text-emerald-700"><Valor v={ev.depois?.[c]} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  // Criou / excluiu: a linha inteira, sem os campos vazios.
  const linha = (ev.acao === "criou" ? ev.depois : ev.antes) ?? {};
  const entradas = Object.entries(linha).filter(([, v]) => v !== null && v !== "" && !(Array.isArray(v) && v.length === 0));
  const visiveis = tudo ? entradas : entradas.slice(0, 12);
  return (
    <div className="mx-3 mb-3 rounded-md border border-gray-200 bg-gray-50 p-2">
      <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        {visiveis.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="w-32 shrink-0 truncate font-medium text-gray-600" title={k}>{rotuloCampo(k)}</dt>
            <dd className="min-w-0 break-words text-gray-800"><Valor v={v} /></dd>
          </div>
        ))}
      </dl>
      {entradas.length > 12 && (
        <button type="button" onClick={() => setTudo((t) => !t)} className="mt-2 text-xs font-medium text-verde-primary hover:underline">
          {tudo ? "Mostrar menos" : `Ver todos os ${entradas.length} campos`}
        </button>
      )}
    </div>
  );
}

function Valor({ v }: { v: unknown }) {
  const texto = formatarValor(v);
  const ehObjeto = v !== null && typeof v === "object" && !Array.isArray(v);
  if (ehObjeto || texto.length > 300) {
    return <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px]">{ehObjeto ? JSON.stringify(v, null, 1) : texto}</pre>;
  }
  return <>{texto}</>;
}
