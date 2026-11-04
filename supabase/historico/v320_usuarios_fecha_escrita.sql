-- v320 — Fecha a escrita em public.usuarios para quem não é Admin (04/11/2026).
--
-- Achado ao conferir a RLS (pedido do João, auditoria das Configurações): a policy
-- "auth write usuarios" (ALL, authenticated, using true / with check true) deixava QUALQUER conta
-- logada alterar ou apagar qualquer linha de usuarios — inclusive pôr perfil = 'Admin' em si mesma.
-- As policies se somam (OR), então a "admin write usuarios" (caller_eh_admin) não adiantava.
--
-- Quem grava em usuarios pelo navegador hoje:
--   • telas de Admin (Usuários, Funções)      → seguem pela "admin write usuarios";
--   • rotas do servidor (criar, credenciais, cert) → service_role, não passam pela RLS;
--   • Portal do cliente › Meu perfil (nome e cargo da própria conta) → passa a usar a RPC abaixo,
--     que só mexe nesses dois campos da conta de quem chama.
--
-- Leitura não muda ("auth read usuarios" continua).
-- Rollback: scripts/sql/v320_usuarios_fecha_escrita_rollback.sql
begin;

create or replace function public.usuario_atualizar_meu_perfil(p_nome text, p_cargo text)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_nome text := btrim(coalesce(p_nome, ''));
begin
  if v_email is null then raise exception 'nao autenticado'; end if;
  if v_nome = '' then raise exception 'Informe o nome.'; end if;

  update public.usuarios
     set nome = v_nome,
         cargo = nullif(btrim(coalesce(p_cargo, '')), '')
   where lower(email) = v_email
     and ativo_sistema = true;

  if not found then raise exception 'Conta não encontrada ou inativa.'; end if;
end $$;

revoke execute on function public.usuario_atualizar_meu_perfil(text, text) from public, anon;
grant execute on function public.usuario_atualizar_meu_perfil(text, text) to authenticated;
comment on function public.usuario_atualizar_meu_perfil(text, text) is
  'v320: a própria conta troca só nome e cargo (Portal do cliente › Meu perfil). O resto de usuarios é só Admin.';

drop policy if exists "auth write usuarios" on public.usuarios;

commit;
