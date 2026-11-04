/**
 * Renomear probabilidade/severidade de uma matriz (ou um tipo de risco) e levar junto os
 * registros que guardam o NOME (riscos, itens da Apreciação). Decisão do João (04/11/2026):
 * ao renomear, os registros antigos passam para o nome novo.
 *
 * `originais[i]` é o nome que a linha i tinha ao abrir o editor (null = linha nova);
 * `novos[i]` é o nome atual. Devolve os pares de/para. Quando um nome novo repete um nome
 * que já existia na lista (troca A↔B, ou juntar duas linhas), não dá para saber de quem é
 * cada registro: devolve `conflito` e nada deve ser levado junto.
 */
export function paresRenomeados(
  originais: readonly (string | null)[],
  novos: readonly string[],
): { pares: { de: string; para: string }[]; conflito: boolean } {
  const antigos = new Set(originais.filter((v): v is string => !!v));
  const pares: { de: string; para: string }[] = [];
  originais.forEach((de, i) => {
    const para = (novos[i] ?? "").trim();
    if (de && para && de !== para) pares.push({ de, para });
  });
  const conflito = pares.some((p) => antigos.has(p.para));
  return { pares: conflito ? [] : pares, conflito };
}
