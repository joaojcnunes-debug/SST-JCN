import type { ClausulaCondicao, CondicaoAutomacao } from "@/lib/hooks/useGestao";

/**
 * Condição E/OU das automações (0.3.294, 17/11/2026): o que o construtor grava sozinho.
 * Cláusula que precisa de valor e está vazia não vai para o banco — uma regra ativa não roda com a condição pela metade.
 */
export const SEM_VALOR = new Set(["vazio", "nao_vazio"]);

/** A cláusula está pronta para gravar: tem campo e, se o operador pede, um valor. */
export function clausulaPronta(c: ClausulaCondicao): boolean {
  return !!c.campo && (SEM_VALOR.has(c.op) || String(c.valor ?? "").trim() !== "");
}

/** A condição que vai para o banco: só as cláusulas prontas; sem nenhuma, `all: []` (o E/OU continua ligado). */
export function condicaoParaGravar(all: readonly ClausulaCondicao[], any: readonly ClausulaCondicao[]): CondicaoAutomacao {
  const limpa = (cs: readonly ClausulaCondicao[]) =>
    cs.filter(clausulaPronta).map((c) => ({ campo: c.campo, op: c.op || "=", valor: SEM_VALOR.has(c.op) ? "" : c.valor ?? "" }));
  const allL = limpa(all);
  const anyL = limpa(any);
  const cond: CondicaoAutomacao = {};
  if (allL.length) cond.all = allL;
  if (anyL.length) cond.any = anyL;
  if (!allL.length && !anyL.length) cond.all = [];
  return cond;
}
