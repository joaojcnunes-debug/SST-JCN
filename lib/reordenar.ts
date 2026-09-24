/**
 * Reordenação de listas por arrasto.
 *
 * A ordem dos setores da AEP e do AET é a POSIÇÃO dentro de um array `jsonb`
 * (`aep_relatorios.setores` / `aet_relatorios.setores`) — não existe coluna de
 * ordenação em lugar nenhum. Por isso reordenar é só embaralhar o array e
 * salvar o mesmo campo que a tela já salvava: nenhuma migration envolvida.
 *
 * A tela, a prévia do laudo e o template do PDF percorrem esse mesmo array na
 * ordem em que ele está, e numeram por índice — então a ordem escolhida aqui é
 * a que sai impressa.
 *
 * Funções puras de propósito: dá para conferir o resultado sem montar React.
 */

/** De que lado do item alvo o arrasto vai cair. */
export type LadoDrop = "antes" | "depois";

/** Compara duas listas só pela ordem dos ids. */
export function mesmaOrdem<T extends { id: string }>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((item, i) => item.id === b[i].id);
}

/**
 * Move `origemId` para antes ou depois de `alvoId`.
 * Devolve o array ORIGINAL (mesma referência) quando nada muda — assim quem
 * chama consegue decidir se vale a pena salvar.
 */
export function moverPara<T extends { id: string }>(
  itens: T[],
  origemId: string,
  alvoId: string,
  lado: LadoDrop,
): T[] {
  if (origemId === alvoId) return itens;

  const origem = itens.find((i) => i.id === origemId);
  if (!origem) return itens;

  const resto = itens.filter((i) => i.id !== origemId);
  const alvo = resto.findIndex((i) => i.id === alvoId);
  if (alvo === -1) return itens;

  const novos = [...resto];
  novos.splice(lado === "depois" ? alvo + 1 : alvo, 0, origem);

  return mesmaOrdem(itens, novos) ? itens : novos;
}

/**
 * Move um item N posições (o caminho do teclado: ↑ = -1, ↓ = +1).
 * Nas pontas devolve o array original, sem dar a volta na lista.
 */
export function moverPasso<T extends { id: string }>(
  itens: T[],
  id: string,
  passo: number,
): T[] {
  const de = itens.findIndex((i) => i.id === id);
  if (de === -1) return itens;

  const para = de + passo;
  if (para < 0 || para >= itens.length) return itens;

  const novos = [...itens];
  novos[de] = itens[para];
  novos[para] = itens[de];
  return novos;
}

/**
 * Posição final (contando de 1) que o item arrastado assume se soltar ali.
 * É o número que aparece na bolinha em cima da barra verde de destino.
 */
export function posicaoDestino<T extends { id: string }>(
  itens: T[],
  origemId: string,
  alvoId: string,
  lado: LadoDrop,
): number {
  const resto = itens.filter((i) => i.id !== origemId);
  const alvo = resto.findIndex((i) => i.id === alvoId);
  if (alvo === -1) return 1;
  return (lado === "depois" ? alvo + 1 : alvo) + 1;
}
