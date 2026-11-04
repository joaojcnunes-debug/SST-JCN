/**
 * Opções de uma categoria OWAS (Config. OWAS).
 *
 * O setor grava só o NÚMERO da opção marcada (`owas.posturas_costas = [1, 3]`)
 * e o rótulo é buscado pelo número na hora de mostrar. Dois rótulos com o
 * mesmo número ficam indistinguíveis: o laudo e o PDF sempre achariam o
 * primeiro. A caixa de número aceitava repetido sem reclamar (04/11/2026).
 */

/** Números que aparecem mais de uma vez, em ordem crescente e sem repetir. */
export function valoresRepetidos(opcoes: { value: number }[]): number[] {
  const vistos = new Set<number>();
  const repetidos = new Set<number>();
  for (const o of opcoes) {
    if (vistos.has(o.value)) repetidos.add(o.value);
    vistos.add(o.value);
  }
  return [...repetidos].sort((a, b) => a - b);
}
