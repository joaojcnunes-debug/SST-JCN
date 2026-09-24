/**
 * Busca TODAS as linhas de uma query paginando de 1000 em 1000.
 *
 * O PostgREST devolve no máximo ~1000 linhas por requisição (teto padrão). Sem
 * paginar, gráficos que varrem tabelas inteiras (dashboard) passam a subcontar
 * em silêncio quando a base cresce além de 1000 registros. Este helper repete a
 * query com `.range()` até esgotar.
 *
 * Uso:
 *   const linhas = await fetchAllRows<{ status: string }>(
 *     (de, ate) => sb.from("inspecoes").select("status").neq("status","DELETADA").range(de, ate),
 *   );
 */
export async function fetchAllRows<T>(
  page: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const TAMANHO = 1000;
  const todas: T[] = [];
  for (let de = 0; ; de += TAMANHO) {
    const { data, error } = await page(de, de + TAMANHO - 1);
    if (error) throw new Error(error.message);
    const linhas = data ?? [];
    todas.push(...linhas);
    if (linhas.length < TAMANHO) break;
  }
  return todas;
}
