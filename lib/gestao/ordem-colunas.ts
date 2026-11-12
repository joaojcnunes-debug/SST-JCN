// Mover as colunas do quadro arrastando (11/11/2026). Pedido do usuário: "destrave as colunas para poder mover
// livremente pra onde eu quiser em todas as listas". A ordem é a do quadro (gestao_status.ordem), a mesma das setas
// em Configurar › Status: vale para todos que usam a lista. A sincronização do Runrun só cria a coluna que falta e não
// regrava a ordem.

/** Nova ordem dos slugs: `de` sai do lugar e entra antes (ou depois) de `alvo`. Sem mudança, devolve a mesma lista. */
export function moverColuna(slugs: string[], de: string, alvo: string, depois: boolean): string[] {
  if (de === alvo || !slugs.includes(de) || !slugs.includes(alvo)) return slugs;
  const sem = slugs.filter((s) => s !== de);
  const i = sem.indexOf(alvo) + (depois ? 1 : 0);
  const nova = [...sem.slice(0, i), de, ...sem.slice(i)];
  return nova.every((s, k) => s === slugs[k]) ? slugs : nova;
}

/** Só as colunas cuja posição mudou, com a ordem nova (0, 1, 2… na sequência da tela). */
export function ordensMudadas<T extends { id: string; slug: string; ordem: number }>(
  colunas: T[],
  novaOrdem: string[],
): { id: string; ordem: number }[] {
  const porSlug = new Map(colunas.map((c) => [c.slug, c]));
  return novaOrdem.flatMap((slug, ordem) => {
    const c = porSlug.get(slug);
    return c && c.ordem !== ordem ? [{ id: c.id, ordem }] : [];
  });
}
