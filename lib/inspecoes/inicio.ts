/**
 * Associado só abre o documento depois de Iniciar (pedido dele, 30/10/2026).
 *
 * O documento (relatório e Versão PGR) fica fechado para quem está associado à
 * inspeção e não é supervisor/admin enquanto a elaboração não começou
 * (`elaboracao_status` PENDENTE — o "Atribuído" da lista). Usado por
 * components/inspecoes/AguardandoInicio.tsx; testado em inicio.test.ts.
 *
 * @param supervisor `ehSupervisor(user)` de quem chama (supervisor/admin abrem direto).
 */
export function associadoAguardandoInicio(
  user: { id_usuario?: string | null; nome?: string | null } | null | undefined,
  supervisor: boolean,
  associados: ReadonlyArray<{ id_usuario?: string | null; nome?: string | null }>,
  elaboracaoStatus: string | null | undefined,
): boolean {
  if (!user || supervisor) return false;
  if ((elaboracaoStatus ?? "PENDENTE") !== "PENDENTE") return false;
  const nome = user.nome?.trim().toLowerCase();
  return associados.some(
    (a) => (!!a.id_usuario && a.id_usuario === user.id_usuario) || (!!nome && a.nome?.trim().toLowerCase() === nome),
  );
}
