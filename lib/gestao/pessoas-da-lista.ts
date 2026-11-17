/**
 * Quem o seletor de Responsável/Alocado oferece numa tarefa (17/11/2026, pedido do João: "puxar somente as pessoas
 * (equipe) que fazem parte da lista").
 *
 * `daLista` = os e-mails da equipe da lista (`gestao_equipe_da_lista`, v357: quem foi colocado nela em Membros e
 * acessos, direto ou por equipe, na lista, na pasta ou no espaço — inclusive admin). Ficam também:
 *  • quem já está escolhido (`manter`) — a tarefa antiga com alguém de fora continua mostrando essa pessoa;
 *  • eu — quem abre a tarefa precisa poder se atribuir, mesmo fora da equipe (o administrador vê todas as listas).
 * `daLista = null` (lista sem equipe cadastrada, sem quadro, ainda carregando ou a consulta falhou): todos, como era
 * antes — nunca trava a tela.
 */
export function pessoasDaLista<U extends { email: string }>(
  usuarios: readonly U[],
  daLista: ReadonlySet<string> | null,
  manter: readonly (string | null | undefined)[] = [],
  meuEmail?: string | null,
): U[] {
  if (!daLista) return [...usuarios];
  const extra = new Set([...manter, meuEmail].filter((e): e is string => !!e).map((e) => e.trim().toLowerCase()));
  return usuarios.filter((u) => {
    const e = u.email.trim().toLowerCase();
    return daLista.has(e) || extra.has(e);
  });
}

/** O conjunto de e-mails da lista, ou null quando não dá para filtrar (sem equipe cadastrada, sem quadro, carregando ou erro). */
export function emailsDaLista(pessoas: readonly { email: string }[] | undefined, idQuadro: string | null | undefined, erro: boolean): Set<string> | null {
  if (!idQuadro || erro || !pessoas || pessoas.length === 0) return null;
  return new Set(pessoas.map((p) => p.email.trim().toLowerCase()));
}
