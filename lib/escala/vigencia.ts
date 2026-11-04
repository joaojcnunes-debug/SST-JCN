/**
 * Regra de vigência do padrão semanal, sem banco (0.3.231).
 *
 * Salvar um padrão que passa a valer em X fecha o anterior na véspera de X. "Limpar o dia"
 * segue a mesma régua: o dia fica vazio a partir de X, então o padrão vigente termina na
 * véspera de X. Antes, limpar sempre encerrava com a data de hoje, qualquer que fosse a
 * data escolhida na tela.
 */
import { dataPura, paraDataLocal } from "./datas";

/** A véspera de uma data pura, sem passar por fuso. */
export function vespera(iso: string): string {
  const d = paraDataLocal(iso);
  d.setDate(d.getDate() - 1);
  return dataPura(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function ddmmaaaa(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

export type FimAoLimpar =
  | { ok: true; vigencia_fim: string }
  | { ok: false; motivo: string };

/**
 * Até quando o padrão fica valendo se a pessoa limpar o dia a partir de `aPartirDe`.
 *
 * Recusa (sem mexer em nada) quando não há o que encerrar:
 * - o padrão começa em `aPartirDe` ou depois: encerrar na véspera deixaria o fim antes do
 *   início, o que o banco recusa (CHECK da v190);
 * - o padrão já termina antes de `aPartirDe`.
 */
export function fimAoLimpar(
  padrao: { vigencia_inicio: string; vigencia_fim: string | null },
  aPartirDe: string,
): FimAoLimpar {
  if (aPartirDe <= padrao.vigencia_inicio) {
    return {
      ok: false,
      motivo: `Este padrão começa em ${ddmmaaaa(padrao.vigencia_inicio)}. Para limpar o dia, escolha uma data depois disso.`,
    };
  }
  const fim = vespera(aPartirDe);
  if (padrao.vigencia_fim !== null && padrao.vigencia_fim <= fim) {
    return {
      ok: false,
      motivo: `Este padrão já termina em ${ddmmaaaa(padrao.vigencia_fim)}, antes da data escolhida. Nada a limpar.`,
    };
  }
  return { ok: true, vigencia_fim: fim };
}
