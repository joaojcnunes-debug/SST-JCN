-- v345 — Sistema › Usuários também para supervisores (nível Aprovação/Admin), com travas (11/11/2026, 0.3.274).
--
-- Trazida da v355 do Painel (0.3.924). Decisão do João (11/11): "trazer igual". Todo nível Aprovação pode criar,
-- ativar/desativar, editar módulos/unidades/empresas e trocar senha/e-mail. Excluir continua só Admin.
--
-- Até aqui só Admin gravava em public.usuarios (política "admin write usuarios", FOR ALL). Agora, ALÉM dela:
--   • UPDATE (política nova "supervisor update usuarios"): o supervisor, só em conta COMUM (nem Admin, nem nível
--     Aprovação/Admin — inclui a própria) e sem deixá-la Admin ou com nível de supervisão;
--   • gatilho usuarios_trava_supervisor: o supervisor não muda os campos do Admin (envio ao SGG e sua auditoria,
--     assinatura, certificado, e-mail direto na tabela, id). O JCN não tem a coluna `oculto` do Painel.
--   • INSERT e DELETE: sem mudança (Admin). A conta nova entra pela rota /api/usuarios/criar (service role), que
--     aplica a mesma regra — lib/usuarios/gestao-supervisor.ts. As funções de reserva (criar_usuario_admin etc., sem a
--     chave de service role) continuam só para Admin.
-- O service role não tem e-mail no JWT: as funções dão false e a trava não se aplica a ele.
--
-- REAPLICAR: idempotente. ROLLBACK: scripts/sql/v345_usuarios_supervisor_gerencia_rollback.sql

begin;

do $$ begin
  if to_regprocedure('public.caller_eh_admin()') is null then
    raise exception 'v345: falta caller_eh_admin()';
  end if;
end $$;

create or replace function public.caller_gere_usuarios()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.usuarios u
     where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
       and u.ativo_sistema = true
       and (u.perfil = 'Admin' or u.nivel in ('Aprovacao', 'Admin'))
  );
$$;
revoke all on function public.caller_gere_usuarios() from public, anon;
grant execute on function public.caller_gere_usuarios() to authenticated;
comment on function public.caller_gere_usuarios() is
  'v345 (= v355 do Painel): quem chama abre Sistema › Usuários? Admin ativo ou nível Aprovação/Admin. Espelho de podeGerirUsuarios (lib/usuarios/gestao-supervisor.ts).';

create or replace function public.usuario_conta_protegida(p_perfil text, p_nivel text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_perfil, '') = 'Admin' or coalesce(p_nivel, '') in ('Aprovacao', 'Admin');
$$;
comment on function public.usuario_conta_protegida(text, text) is
  'v345 (= v355 do Painel): Admin ou nível Aprovação/Admin — o supervisor não edita, não promove a isso. Espelho de contaProtegida.';

drop policy if exists "supervisor update usuarios" on public.usuarios;
create policy "supervisor update usuarios" on public.usuarios
  for update to authenticated
  using (public.caller_gere_usuarios() and not public.usuario_conta_protegida(perfil, nivel))
  with check (public.caller_gere_usuarios() and not public.usuario_conta_protegida(perfil, nivel));

create or replace function public.usuarios_trava_supervisor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admin e service role passam direto; a trava é só para o supervisor que não é Admin.
  if public.caller_eh_admin() or not public.caller_gere_usuarios() then
    return new;
  end if;
  if new.id_usuario is distinct from old.id_usuario
     or new.email is distinct from old.email
     or new.pode_enviar_sgg is distinct from old.pode_enviar_sgg
     or new.pode_enviar_sgg_concedido_por is distinct from old.pode_enviar_sgg_concedido_por
     or new.pode_enviar_sgg_concedido_em is distinct from old.pode_enviar_sgg_concedido_em
     or new.assinatura_url is distinct from old.assinatura_url
     or new.mostrar_assinatura_imagem is distinct from old.mostrar_assinatura_imagem
     or new.tipo_certificado is distinct from old.tipo_certificado
     or new.certificado_pfx_path is distinct from old.certificado_pfx_path
     or new.certificado_validade is distinct from old.certificado_validade
     or new.certificado_titular is distinct from old.certificado_titular
  then
    raise exception 'Envio ao SGG, assinatura, certificado e e-mail ficam com um administrador'
      using errcode = '42501';
  end if;
  return new;
end $$;
comment on function public.usuarios_trava_supervisor() is
  'v345 (= v355 do Painel): o supervisor (não Admin) edita a conta comum, mas não os campos do Admin. Espelho de CAMPOS_SO_ADMIN.';

drop trigger if exists usuarios_trava_supervisor on public.usuarios;
create trigger usuarios_trava_supervisor
  before update on public.usuarios
  for each row execute function public.usuarios_trava_supervisor();

notify pgrst, 'reload schema';

commit;
