/**
 * Opções que a Análise e Avaliação (DRPS e QPS) oferece a partir de um catálogo editável
 * (Agravos, Medidas recomendadas).
 *
 * - Catálogo ainda não carregado ou tabela sem nenhuma linha (nunca configurado): usa a base
 *   fixa, para a Análise não ficar sem opções.
 * - Catálogo com linhas: só os itens ativos. Se todos estiverem desativados, a lista fica
 *   vazia — desativar tudo não pode trazer a base inteira de volta.
 */
export function opcoesDoCatalogo(
  linhas: ReadonlyArray<{ titulo: string; ativo: boolean }> | null | undefined,
  base: readonly string[],
): string[] {
  if (!linhas || linhas.length === 0) return [...base];
  return linhas.filter((l) => l.ativo).map((l) => l.titulo);
}
