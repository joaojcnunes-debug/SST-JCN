/**
 * Associado só abre o documento com o tempo contando (pedidos dele de 30/10/2026).
 *
 * O documento (relatório e Versão PGR) fica fechado para quem está associado à inspeção e não
 * é supervisor/admin enquanto ele não tiver a PRÓPRIA sessão de trabalho aberta (v311:
 * Iniciar/Retomar). Documento entregue (CONCLUIDO) abre para leitura. Usado por
 * components/inspecoes/AguardandoInicio.tsx; testado em inicio.test.ts.
 *
 * @param supervisor `ehSupervisor(user)` de quem chama (supervisor/admin abrem direto).
 * @param sessaoAberta a pessoa tem sessão correndo neste documento (lib/inspecoes/sessoes).
 */
export function associadoAguardandoInicio(
  user: { id_usuario?: string | null; nome?: string | null } | null | undefined,
  supervisor: boolean,
  associados: ReadonlyArray<{ id_usuario?: string | null; nome?: string | null }>,
  elaboracaoStatus: string | null | undefined,
  sessaoAberta: boolean,
): boolean {
  if (!user || supervisor || sessaoAberta) return false;
  if (elaboracaoStatus === "CONCLUIDO") return false;
  return ehAssociado(user, associados);
}

/** A pessoa está entre os associados (por id ou, nos registros antigos, pelo nome). */
export function ehAssociado(
  user: { id_usuario?: string | null; nome?: string | null } | null | undefined,
  associados: ReadonlyArray<{ id_usuario?: string | null; nome?: string | null }>,
): boolean {
  if (!user) return false;
  const nome = user.nome?.trim().toLowerCase();
  return associados.some(
    (a) => (!!a.id_usuario && a.id_usuario === user.id_usuario) || (!!nome && a.nome?.trim().toLowerCase() === nome),
  );
}
