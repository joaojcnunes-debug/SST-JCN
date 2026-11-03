/**
 * "Dias sem acidente com afastamento" da Visão geral (Etapa 3 do docs/plano-skin-viva-jcn.md).
 *
 * Conta a partir da data do último acidente COM afastamento (investigacoes_acidente). Sem
 * nenhum registrado, devolve null e a tela diz "Nenhum acidente com afastamento registrado" —
 * decisão do João (03/11/2026): não inventar uma data de início. Datas em São Paulo
 * (AAAA-MM-DD); o dia do acidente conta como 0.
 */
export function diasSemAcidente(ultimoComAfastamento: string | null | undefined, hojeISO: string): number | null {
  if (!ultimoComAfastamento) return null;
  const de = Date.parse(`${ultimoComAfastamento.slice(0, 10)}T00:00:00Z`);
  const ate = Date.parse(`${hojeISO.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(de) || !Number.isFinite(ate)) return null;
  return Math.max(0, Math.round((ate - de) / 86_400_000));
}
