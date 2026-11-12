/**
 * Limite de cartões por coluna (WIP, v348 — 11/11/2026). É um AVISO, não uma trava: o cabeçalho da coluna mostra
 * "3/10" (vermelho quando passa) e mover um cartão para uma coluna cheia pede confirmação. Automações não são barradas.
 *  - limite_wip: máximo de cartões abertos na coluna;
 *  - limite_por_pessoa: o máximo vale por responsável (ex.: 10 em Elaboração por técnico); cartão sem responsável não conta.
 * Funções puras (testadas em wip.test.ts).
 */

export interface ColunaWip {
  slug: string;
  nome: string;
  tipo?: string;
  limite_wip?: number | null;
  limite_por_pessoa?: boolean;
}

export interface CartaoWip {
  id_tarefa: string;
  status: string;
  /** Linha de subtarefa na vista: não conta (só os cartões da lista). */
  sub_linha?: unknown;
}

export interface ContagemWip {
  total: number;
  /** e-mail (minúsculo) → cartões abertos dessa pessoa na coluna. */
  porPessoa: Map<string, number>;
}

const temLimite = (c: ColunaWip) => c.tipo !== "concluido" && !!c.limite_wip && c.limite_wip > 0;

/** Cartões da coluna, no total e por responsável. */
export function contarWip(
  cartoes: readonly CartaoWip[],
  slug: string,
  responsaveisDe: (idTarefa: string) => readonly string[],
): ContagemWip {
  const porPessoa = new Map<string, number>();
  let total = 0;
  for (const t of cartoes) {
    if (t.status !== slug || t.sub_linha) continue;
    total++;
    for (const e of new Set(responsaveisDe(t.id_tarefa).map((x) => x.toLowerCase()))) {
      porPessoa.set(e, (porPessoa.get(e) ?? 0) + 1);
    }
  }
  return { total, porPessoa };
}

export interface EstadoWip {
  /** Texto curto do cabeçalho: "3/10" ou "máx. 10/pessoa"; null sem limite. */
  texto: string | null;
  excedido: boolean;
  /** Por pessoa: quem passou do limite (e-mails). */
  acima: string[];
  dica: string | null;
}

export function estadoWip(c: ColunaWip, n: ContagemWip, nomeDe: (email: string) => string = (e) => e): EstadoWip {
  if (!temLimite(c)) return { texto: null, excedido: false, acima: [], dica: null };
  const lim = c.limite_wip!;
  if (c.limite_por_pessoa) {
    const acima = [...n.porPessoa].filter(([, q]) => q > lim).map(([e]) => e).sort();
    return {
      texto: `máx. ${lim}/pessoa`,
      excedido: acima.length > 0,
      acima,
      dica: acima.length
        ? `Limite de ${lim} cartões por pessoa em "${c.nome}" passado por: ${acima.map(nomeDe).join(", ")}`
        : `Limite de ${lim} cartões por pessoa em "${c.nome}"`,
    };
  }
  return {
    texto: `${n.total}/${lim}`,
    excedido: n.total > lim,
    acima: [],
    dica: n.total > lim ? `"${c.nome}" está com ${n.total} cartões; o limite é ${lim}` : `Limite de ${lim} cartões em "${c.nome}"`,
  };
}

/**
 * Mover um cartão para a coluna `c` passa do limite? Devolve o aviso para a confirmação, ou null.
 * `responsaveis` = os do cartão que está sendo movido; `jaEsta` = o cartão já estava nessa coluna (não soma).
 */
export function avisoAoMover(
  c: ColunaWip, n: ContagemWip, responsaveis: readonly string[], jaEsta = false, nomeDe: (email: string) => string = (e) => e,
): string | null {
  if (!temLimite(c) || jaEsta) return null;
  const lim = c.limite_wip!;
  if (c.limite_por_pessoa) {
    const cheias = [...new Set(responsaveis.map((e) => e.toLowerCase()))].filter((e) => (n.porPessoa.get(e) ?? 0) + 1 > lim);
    if (!cheias.length) return null;
    return `Com este cartão, ${cheias.map(nomeDe).join(", ")} ${cheias.length === 1 ? "passa" : "passam"} do limite de ${lim} por pessoa em "${c.nome}".`;
  }
  if (n.total + 1 <= lim) return null;
  return `"${c.nome}" vai ficar com ${n.total + 1} cartões; o limite é ${lim}.`;
}
