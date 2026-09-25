/**
 * A Vercel do JCN não tem SUPABASE_SERVICE_ROLE_KEY. Sem ela, as rotas de
 * /api/usuarios caem nas funções SECURITY DEFINER do banco
 * (criar_usuario_admin, excluir_usuario_admin, redefinir_senha_admin,
 * atualizar_email_admin), que checam Admin ativo pelo JWT de quem chama.
 * Com a chave configurada, voltam a usar a Admin API do Auth.
 */
export function temServiceRole(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}
