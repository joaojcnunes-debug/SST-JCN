/**
 * Calendário de uma pessoa (ou equipe) dentro de uma lista (12/11/2026, pedidos do usuário): só os cartões DA LISTA,
 * e entram os em que a pessoa é RESPONSÁVEL, SEGUIDORA ou CRIOU o cartão. Regra pura (testada offline).
 */
import { temResponsavel } from "@/lib/gestao/responsaveis";

export interface VinculoMin { usuario_email: string; tipo: string }

/**
 * @param emails  e-mails (minúsculas) da pessoa ou dos membros da equipe
 * @param nomes   nomes dessas pessoas (cartões antigos guardam o responsável só pelo nome)
 * @param vinculos responsáveis/seguidores do cartão
 * @param chaveCriador chave de `criadorDe` ("e:<email>" quando quem criou é uma pessoa conhecida)
 */
export function cartaoDaPessoa(
  t: { responsavel: string | null },
  emails: ReadonlySet<string>,
  nomes: readonly string[],
  vinculos: readonly VinculoMin[],
  chaveCriador: string | null,
): boolean {
  if (!emails.size) return false;
  if (vinculos.some((v) => (v.tipo === "responsavel" || v.tipo === "seguidor") && emails.has(v.usuario_email.trim().toLowerCase()))) return true;
  if (chaveCriador?.startsWith("e:") && emails.has(chaveCriador.slice(2).toLowerCase())) return true;
  return nomes.some((n) => !!n && temResponsavel(t.responsavel, n));
}
