/**
 * Consolidação dos fatores psicossociais do AET (v135).
 *
 * Desde a v135 há UMA linha por (setor, fator) em aet_laudo_fatores_psi — antes
 * era uma por laudo, e o texto de um setor vazava para todos os outros.
 *
 * Server-safe de propósito (sem "use client"): é usado tanto pela página de
 * laudo (client) quanto pelo template de PDF (render no servidor). Manter a
 * regra AQUI, num lugar só, evita que as duas telas divirjam — foi justamente
 * a duplicação entre elas que deixou o bug original passar batido num dos lados.
 */
import type { ZonaPsi } from "@/lib/supabase/types";

export const ZONA_SEVERIDADE: Record<ZonaPsi, number> = {
  verde: 0,
  amarela: 1,
  laranja: 2,
  vermelha: 3,
};

/** Forma mínima de uma linha de aet_laudo_fatores_psi. */
export interface FatorPsiLinha {
  id_setor: string;
  codigo_fator: string;
  avaliado?: boolean;
  media?: number | null;
  zona?: ZonaPsi | null;
  observacao?: string | null;
  pergunta_critica?: string | null;
}

/** Zona mais grave entre duas (nulos são ignorados). */
export function piorZona(a: ZonaPsi | null, b: ZonaPsi | null): ZonaPsi | null {
  if (!a) return b;
  if (!b) return a;
  return ZONA_SEVERIDADE[b] > ZONA_SEVERIDADE[a] ? b : a;
}

/**
 * Descarta linhas de setores que não existem mais no laudo.
 *
 * `id_setor` não tem FK (os setores vivem no JSONB aet_relatorios.setores), então
 * excluir um setor deixa as linhas dele para trás. Sem este filtro, um setor já
 * apagado ainda puxaria o quadro geral para a pior zona.
 */
export function apenasSetoresExistentes<T extends FatorPsiLinha>(
  linhas: T[],
  idsSetores: string[],
): T[] {
  const validos = new Set(idsSetores);
  return linhas.filter((l) => validos.has(l.id_setor));
}

/** `a` representa uma condição pior que `b`? Zona manda; média desempata. */
function ehPior(a: FatorPsiLinha, b: FatorPsiLinha): boolean {
  const sa = a.zona ? ZONA_SEVERIDADE[a.zona] : -1;
  const sb = b.zona ? ZONA_SEVERIDADE[b.zona] : -1;
  if (sa !== sb) return sa > sb;
  // Empate de zona: média MENOR é a pior (>= 4.0 verde … < 2.0 vermelha).
  return (a.media ?? Infinity) < (b.media ?? Infinity);
}

/**
 * Consolida os vários setores num quadro geral: cada fator é apresentado na
 * condição MAIS DESFAVORÁVEL encontrada entre os setores — critério conservador,
 * o único defensável num laudo de SST (se um setor está em zona vermelha, o
 * quadro geral não pode exibir verde).
 *
 * Devolve a própria linha do pior setor, então média e zona saem do MESMO
 * registro gravado, sem recálculo: ficam coerentes entre si, e um laudo de um
 * único setor sai idêntico ao que saía antes da v135.
 */
export function consolidarPiorCaso<T extends FatorPsiLinha>(avaliados: T[]): T[] {
  const porCodigo = new Map<string, T>();
  for (const linha of avaliados) {
    const atual = porCodigo.get(linha.codigo_fator);
    if (!atual || ehPior(linha, atual)) porCodigo.set(linha.codigo_fator, linha);
  }
  return [...porCodigo.values()].sort((a, b) => a.codigo_fator.localeCompare(b.codigo_fator));
}
