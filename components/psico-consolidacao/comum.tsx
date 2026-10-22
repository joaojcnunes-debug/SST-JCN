"use client";

// Peças comuns das abas de análise da Consolidação de Grupo (fase 5).

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { itemPresente, PESO_NIVEL, type ItemMotor, type NivelPresente, type ResultadoMotor } from "@/lib/psico-consolidacao/motor";

/** O que toda aba de análise recebe da página. */
export interface Analise {
  r: ResultadoMotor;
  itens: ItemMotor[];
  nomeEmpresa: (id: string) => string;
  nomeFator: (id: string) => string;
  filtro: FiltroAnalise;
  /** Risco presente por empresa × setor × fator (o maior nível; AEP = Identificado). */
  ocorrencias: Ocorrencia[];
}

export interface Ocorrencia {
  idEmpresa: string;
  setor: string;
  idFator: string;
  nivel: NivelPresente;
}

export function montarOcorrencias(itens: ItemMotor[], fatores: Set<string>, incluirTrivialBaixo: boolean): Ocorrencia[] {
  const m = new Map<string, Ocorrencia>();
  for (const i of itens) {
    if (!fatores.has(i.idFator) || !itemPresente(i, incluirTrivialBaixo)) continue;
    const nivel: NivelPresente = i.origem === "AEP" ? "Identificado" : (i.nivel as NivelPresente);
    const k = [i.idEmpresa, i.setor, i.idFator].join("|");
    const atual = m.get(k);
    if (!atual || PESO_NIVEL[nivel] > PESO_NIVEL[atual.nivel]) m.set(k, { idEmpresa: i.idEmpresa, setor: i.setor, idFator: i.idFator, nivel });
  }
  return [...m.values()];
}

export interface FiltroAnalise {
  empresa: string;
  setor: string;
  fator: string;
}

export const passa = (f: FiltroAnalise, x: { idEmpresa?: string; setor?: string; idFator?: string }) =>
  (!f.empresa || !x.idEmpresa || x.idEmpresa === f.empresa) &&
  (!f.setor || !x.setor || x.setor === f.setor) &&
  (!f.fator || !x.idFator || x.idFator === f.fator);

export const COR_NIVEL: Record<string, string> = {
  Crítico: "bg-red-600 text-white",
  Alto: "bg-orange-500 text-white",
  Médio: "bg-amber-300 text-amber-950",
  Identificado: "bg-indigo-100 text-indigo-800",
  Baixo: "bg-green-100 text-green-800",
};

export function Nivel({ nivel, className }: { nivel: string; className?: string }) {
  return (
    <span className={cn("inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold", COR_NIVEL[nivel] ?? "bg-gray-100 text-gray-700", className)}>
      {nivel}
    </span>
  );
}

export function Cartao({ titulo, valor, detalhe, tom }: { titulo: string; valor: ReactNode; detalhe?: ReactNode; tom?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{titulo}</p>
      <div className={cn("mt-0.5 text-2xl font-bold text-gray-900", tom)}>{valor}</div>
      {detalhe && <p className="mt-0.5 text-xs text-gray-500">{detalhe}</p>}
    </div>
  );
}

export function Secao({ titulo, descricao, children }: { titulo: string; descricao?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-sm font-semibold text-gray-800">{titulo}</h3>
      {descricao && <p className="mb-2 max-w-4xl text-xs text-gray-500">{descricao}</p>}
      {children}
    </section>
  );
}

/** Tabela com rolagem lateral e cabeçalho fixo na primeira coluna. */
export function Tabela({ children, minW = "min-w-[640px]" }: { children: ReactNode; minW?: string }) {
  return (
    <div className="max-h-[70vh] overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className={cn("w-full border-collapse text-sm", minW)}>{children}</table>
    </div>
  );
}

export const TH = "sticky top-0 z-10 bg-gray-50 px-2 py-2 text-left text-xs font-semibold text-gray-600";
export const TH_FATOR = "sticky top-0 z-10 bg-gray-50 px-1 py-2 text-center text-[11px] font-semibold leading-tight text-gray-600 align-bottom";
export const TD = "border-t border-gray-100 px-2 py-1.5 align-top";
export const TD_1A = "sticky left-0 z-[1] border-t border-gray-100 bg-white px-2 py-1.5 align-top font-medium text-gray-800";

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-sm text-gray-500">{children}</p>;
}
