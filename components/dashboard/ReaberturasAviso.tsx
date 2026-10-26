"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import type { Reabertura } from "@/lib/hooks/useDashboardFontes";

/** Rótulo humano da tabela auditada (a inspeção e as abas dela). */
const ROTULO_TABELA: Record<string, string> = {
  inspecoes: "Inspeção",
  setores: "Setores",
  riscos: "Riscos",
  fotos: "Fotos",
  extintores: "Extintores",
  inspecao_maquinas: "Máquinas",
  inspecao_maquinas_setores: "Máquinas × setores",
  responsaveis: "Responsáveis",
  inspecao_associados: "Associados",
};

function valor(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
}

function quando(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

/**
 * Aviso das reaberturas depois da 1ª conclusão (pedido de 26/10/2026): a contagem não muda, mas
 * fica visível QUEM reabriu, quando, se já concluiu de novo e a LISTA DE CAMPOS ALTERADOS (antes →
 * depois), lida da auditoria (v295, `dashboard_reaberturas`).
 */
export default function ReaberturasAviso({
  reaberturas,
  nomeDoEmail,
  empresaDe,
  titulo,
}: {
  reaberturas: readonly Reabertura[];
  nomeDoEmail: (email: string | null) => string;
  empresaDe: (idInspecao: string) => string;
  titulo: string;
}) {
  const [aberta, setAberta] = useState<string | null>(null);
  if (reaberturas.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <p className="flex items-center gap-1.5 font-semibold">
        <RotateCcw className="size-3.5" /> {reaberturas.length} {titulo}
      </p>
      <p className="mt-0.5 text-amber-800">
        A contagem continua no mês e na pessoa da 1ª conclusão. Clique para ver quem reabriu e o que mudou.
      </p>
      <ul className="mt-2 space-y-1">
        {reaberturas.map((r) => {
          const chave = `${r.id_inspecao}|${r.reaberta_em}`;
          const ok = aberta === chave;
          return (
            <li key={chave} className="rounded-md bg-white/70 px-2 py-1.5">
              <button type="button" onClick={() => setAberta(ok ? null : chave)} className="flex w-full items-start gap-1.5 text-left">
                {ok ? <ChevronDown className="mt-0.5 size-3.5 shrink-0" /> : <ChevronRight className="mt-0.5 size-3.5 shrink-0" />}
                <span>
                  <strong>{empresaDe(r.id_inspecao)}</strong> — reaberta por <strong>{nomeDoEmail(r.reaberta_por)}</strong> em{" "}
                  {quando(r.reaberta_em)}
                  {r.reconcluida_em ? ` · concluída de novo em ${quando(r.reconcluida_em)}` : " · ainda não concluída de novo"}
                  {` · ${r.alteracoes.length} alteraç${r.alteracoes.length !== 1 ? "ões" : "ão"}`}
                </span>
              </button>
              {ok && (
                <div className="mt-2 overflow-x-auto">
                  {r.alteracoes.length === 0 ? (
                    <p className="text-gray-600">Nenhum campo foi alterado entre a reabertura e a nova conclusão.</p>
                  ) : (
                    <table className="w-full text-left text-[11px] text-gray-700">
                      <thead>
                        <tr className="border-b border-amber-100 text-gray-500">
                          <th className="py-1 pr-2 font-medium">Quando</th>
                          <th className="py-1 pr-2 font-medium">Quem</th>
                          <th className="py-1 pr-2 font-medium">Onde</th>
                          <th className="py-1 pr-2 font-medium">Campo</th>
                          <th className="py-1 pr-2 font-medium">Antes</th>
                          <th className="py-1 font-medium">Depois</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.alteracoes.map((a, k) => (
                          <tr key={k} className="border-b border-amber-50 last:border-0 align-top">
                            <td className="whitespace-nowrap py-1 pr-2">{quando(a.em)}</td>
                            <td className="py-1 pr-2">{nomeDoEmail(a.por)}</td>
                            <td className="py-1 pr-2">
                              {ROTULO_TABELA[a.tabela] ?? a.tabela}
                              {a.acao !== "editou" ? ` (${a.acao})` : ""}
                            </td>
                            <td className="py-1 pr-2 font-mono">{a.campo}</td>
                            <td className="py-1 pr-2 text-red-700">{valor(a.antes)}</td>
                            <td className="py-1 text-emerald-700">{valor(a.depois)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <Link href={`/inspecoes/${r.id_inspecao}`} className="mt-1 inline-block font-medium text-sky-700 hover:underline">
                    Abrir a inspeção
                  </Link>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
