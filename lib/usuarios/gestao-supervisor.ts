/**
 * Sistema › Usuários para supervisores (10/11/2026).
 *
 * Pedido: "fazer com que os supervisores tenham acesso a essa parte de usuários" (OS da Thaynara,
 * que perdeu o acesso ao deixar de ser Admin em 21/09). Decisão dele: TODO nível Aprovação, podendo
 * criar, ativar/desativar, editar módulos/unidades/empresas e trocar senha/e-mail. Excluir segue Admin.
 *
 * As travas (as mesmas no banco, v353, e nas rotas /api/usuarios/*):
 *  - conta PROTEGIDA = Admin ou nível Aprovação/Admin (inclui a própria): o supervisor não edita,
 *    não ativa/desativa e não troca senha/e-mail dela;
 *  - o supervisor não cria nem promove ninguém a perfil Admin ou a nível Aprovação/Admin;
 *  - campos que seguem só do Admin: envio ao SGG (com a auditoria dele), assinatura/certificado,
 *    e-mail direto na tabela (o e-mail muda pela rota de credenciais) e `oculto`.
 */

export type ContaRegra = {
  perfil?: string | null;
  nivel?: string | null;
};

const NIVEIS_SUPERVISAO = new Set(["Aprovacao", "Admin"]);

/** Admin, ou nível Aprovação/Admin: abre Sistema › Usuários. */
export function podeGerirUsuarios(user: ContaRegra | null | undefined): boolean {
  if (!user) return false;
  if (user.perfil === "Admin") return true;
  return NIVEIS_SUPERVISAO.has(user.nivel ?? "");
}

/** Só o perfil Admin: excluir, campos do Admin e contas protegidas. */
export function ehAdminTotal(user: ContaRegra | null | undefined): boolean {
  return user?.perfil === "Admin";
}

/** Conta que o supervisor (não Admin) não mexe: Admin ou outro supervisor, inclusive ele mesmo. */
export function contaProtegida(alvo: ContaRegra | null | undefined): boolean {
  if (!alvo) return false;
  return alvo.perfil === "Admin" || NIVEIS_SUPERVISAO.has(alvo.nivel ?? "");
}

/** O supervisor pode mexer nesta conta? Admin pode em todas. */
export function podeEditarConta(quem: ContaRegra | null | undefined, alvo: ContaRegra | null | undefined): boolean {
  if (ehAdminTotal(quem)) return true;
  if (!podeGerirUsuarios(quem)) return false;
  return !contaProtegida(alvo);
}

/** Campos que só o Admin grava (o supervisor manda o valor que já estava). */
export const CAMPOS_SO_ADMIN = [
  "pode_enviar_sgg",
  "pode_enviar_sgg_concedido_por",
  "pode_enviar_sgg_concedido_em",
  "assinatura_url",
  "mostrar_assinatura_imagem",
  "tipo_certificado",
  "certificado_pfx_path",
  "certificado_validade",
  "certificado_titular",
  "oculto",
] as const;

/**
 * Motivo para recusar a conta que o supervisor quer gravar (criar ou o estado final de uma edição),
 * ou `null` se pode. Admin: sempre `null`.
 */
export function motivoRecusaSupervisor(quem: ContaRegra | null | undefined, nova: ContaRegra): string | null {
  if (ehAdminTotal(quem)) return null;
  if (!podeGerirUsuarios(quem)) return "Apenas administradores e supervisores podem gerenciar usuários";
  if (nova.perfil === "Admin") return "Só um administrador pode dar o perfil Admin";
  if (NIVEIS_SUPERVISAO.has(nova.nivel ?? "")) return "Só um administrador pode dar o nível de supervisão";
  return null;
}

/** Conta criada por supervisor: tira os campos do Admin (a conta nasce com o padrão do banco). */
export function semCamposSoAdmin<T extends Record<string, unknown>>(corpo: T): T {
  const c: Record<string, unknown> = { ...corpo };
  for (const k of CAMPOS_SO_ADMIN) delete c[k];
  return c as T;
}
