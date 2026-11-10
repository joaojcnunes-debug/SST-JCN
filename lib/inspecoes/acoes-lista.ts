/**
 * Coluna Ações da lista de Inspeções.
 *
 * Supervisor/admin veem Editar, Relatório e Excluir (30/10/2026). Quem tem a marca
 * `ve_relatorio_lista` (v332, por pessoa, em Sistema › Usuários) vê só o Ver relatório.
 * O resto continua sem a coluna e age por Minhas inspeções. Cliente nunca vê pela marca.
 *
 * @param supervisor `ehSupervisor(user)` de quem chama.
 */
export function acoesDaLista(
  user: { perfil?: string | null; ve_relatorio_lista?: boolean | null } | null | undefined,
  supervisor: boolean,
): { coluna: boolean; editar: boolean } {
  if (supervisor) return { coluna: true, editar: true };
  return { coluna: !!user && user.perfil !== "Cliente" && user.ve_relatorio_lista === true, editar: false };
}

/**
 * Quem tem a marca só consulta o documento (pedido de 04/11/2026: são da agenda, não técnicos):
 * no relatório não aparecem Assumir elaboração nem Associar-me. Supervisor/admin não mudam.
 */
export function soConsultaDocumento(
  user: { ve_relatorio_lista?: boolean | null } | null | undefined,
  supervisor: boolean,
): boolean {
  return !supervisor && user?.ve_relatorio_lista === true;
}
