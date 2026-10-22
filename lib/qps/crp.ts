/**
 * CRP do responsável técnico no laudo da QAP.
 *
 * O CRP digitado na aplicação vale primeiro; em branco, vale o do cadastro do
 * profissional (tabela `usuarios`) cujo nome bate com o responsável. Uma regra
 * só para a prévia da tela e para a rota do PDF — antes só a rota tinha o
 * plano B, e a prévia saía com o CRP vazio.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = any;

export async function resolverCrpQps(
  sb: Cliente,
  ap: { crp?: string | null; responsavel?: string | null } | null | undefined,
): Promise<string | null> {
  const proprio = (ap?.crp ?? "").trim();
  if (proprio) return proprio;
  const nome = (ap?.responsavel ?? "").trim().replace(/\s+/g, " ");
  if (!nome) return null;
  const { data } = await sb
    .from("usuarios")
    .select("crp")
    .ilike("nome", nome)
    .not("crp", "is", null)
    .limit(1)
    .maybeSingle();
  const doCadastro = ((data as { crp: string | null } | null)?.crp ?? "").trim();
  return doCadastro || null;
}
