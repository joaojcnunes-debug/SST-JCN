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
 * @param responsavel `elaboracao_responsavel`: desde a v332, o responsável conta como associado.
 */
export function associadoAguardandoInicio(
  user: { id_usuario?: string | null; nome?: string | null } | null | undefined,
  supervisor: boolean,
  associados: ReadonlyArray<{ id_usuario?: string | null; nome?: string | null }>,
  elaboracaoStatus: string | null | undefined,
  sessaoAberta: boolean,
  responsavel?: string | null,
): boolean {
  if (!user || supervisor || sessaoAberta) return false;
  if (elaboracaoStatus === "CONCLUIDO") return false;
  return estaNoDocumento(user, associados, responsavel);
}

/**
 * A pessoa trabalha neste documento: associada OU responsável, a regra da fila "Minhas inspeções" e de
 * documento_sessao_iniciar (v332). Só o responsável pode não ter linha de associado (documentos antigos).
 */
export function estaNoDocumento(
  user: { id_usuario?: string | null; nome?: string | null } | null | undefined,
  associados: ReadonlyArray<{ id_usuario?: string | null; nome?: string | null }>,
  responsavel: string | null | undefined,
): boolean {
  return ehAssociado(user, associados) || ehResponsavelDocumento(user?.nome, responsavel);
}

/** O nome do responsável é o desta pessoa? Ignora maiúsculas e espaços, como os chips de Associados. */
export function ehResponsavelDocumento(
  nome: string | null | undefined,
  responsavel: string | null | undefined,
): boolean {
  const a = nome?.trim().toLowerCase();
  return !!a && a === responsavel?.trim().toLowerCase();
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

/**
 * Quem conclui o documento em elaboração: qualquer associado (0.3.255, do Painel 0.3.872), o responsável
 * e o supervisor. Quem só consulta (v334) não conclui por estar associado. Documento ainda
 * pendente precisa ser iniciado antes: é o Iniciar que conta o tempo.
 */
export function podeConcluirDocumento(p: {
  elaboracaoStatus: string | null | undefined;
  supervisor: boolean;
  associado: boolean;
  responsavel: boolean;
  soConsulta: boolean;
}): boolean {
  if (p.elaboracaoStatus !== "EM_ELABORACAO") return false;
  return p.supervisor || p.responsavel || (p.associado && !p.soConsulta);
}

/**
 * Quem fica como responsável ao concluir. `null` mantém o nome atual (a RPC preserva).
 *
 * Na 1ª conclusão, o associado que clicou passa a ser o responsável e leva o documento. O resto segue:
 *  - reabrir e concluir de novo não muda a pessoa (v295): volta o nome da 1ª conclusão, para o
 *    card e o dashboard mostrarem o mesmo;
 *  - quem conclui sem estar no documento (supervisor) não leva o crédito.
 */
export function responsavelAoConcluir(p: {
  nome: string | null | undefined;
  associado: boolean;
  primeiraConclusaoEm: string | null | undefined;
  primeiraConclusaoPor: string | null | undefined;
}): string | null {
  if (p.primeiraConclusaoEm) return p.primeiraConclusaoPor?.trim() || null;
  return p.associado ? p.nome?.trim() || null : null;
}
