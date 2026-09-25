-- v260 — login "Database error querying schema" para usuário criado pela
-- função criar_usuario_admin.
--
-- Causa (2026-09-25): a função inseria em auth.users sem as colunas de token.
-- Elas ficavam NULL, e o GoTrue lê essas colunas como texto — NULL derruba o
-- login com "Database error querying schema". Atingiu o primeiro usuário
-- criado por ela (sst.jcnconsultoria@gmail.com). Usuários criados pelo
-- painel/Admin API já têm '' e não foram afetados.
--
-- Correção: (1) troca NULL por '' em quem já existe; (2) a função passa a
-- gravar '' nessas colunas. Aplicada com autorização do usuário em 2026-09-25.

update auth.users set
  confirmation_token     = coalesce(confirmation_token, ''),
  recovery_token         = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change           = coalesce(email_change, '')
where confirmation_token is null or recovery_token is null
   or email_change_token_new is null or email_change is null;

create or replace function public.criar_usuario_admin(
  p_email text, p_senha text, p_nome text, p_cargo text, p_perfil text,
  p_ativo_sistema boolean, p_empresas_vinculadas text[])
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'extensions'
as $function$
declare
  v_user_id uuid;
  v_id_usuario text;
  v_caller_email text;
  v_caller_perfil text;
  v_caller_ativo boolean;
  v_email_norm text;
begin
  if p_email is null or length(trim(p_email)) < 3 then
    raise exception 'E-mail inválido';
  end if;
  if p_senha is null or length(p_senha) < 6 then
    raise exception 'Senha deve ter ao menos 6 caracteres';
  end if;
  if p_perfil not in ('Admin', 'Tecnico', 'Visualizador') then
    raise exception 'Perfil inválido';
  end if;

  v_email_norm := lower(trim(p_email));

  v_caller_email := auth.jwt() ->> 'email';
  if v_caller_email is null or v_caller_email = '' then
    raise exception 'Não autenticado';
  end if;

  select perfil, ativo_sistema into v_caller_perfil, v_caller_ativo
    from public.usuarios where lower(email) = lower(v_caller_email) limit 1;
  if v_caller_perfil is null or v_caller_perfil <> 'Admin' or v_caller_ativo is not true then
    raise exception 'Apenas administradores ativos podem criar usuários';
  end if;

  if exists (select 1 from auth.users where lower(email) = v_email_norm) then
    raise exception 'E-mail já cadastrado';
  end if;

  v_user_id := gen_random_uuid();

  -- v260: as colunas de token vão como '' — NULL quebra o login no GoTrue.
  insert into auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    aud, role, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    is_anonymous, confirmation_token, recovery_token, email_change_token_new,
    email_change
  ) values (
    v_user_id, '00000000-0000-0000-0000-000000000000', v_email_norm,
    crypt(p_senha, gen_salt('bf')), now(), 'authenticated', 'authenticated',
    now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    false, '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_user_id, v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email_norm, 'email_verified', true),
    'email', now(), now(), now()
  );

  v_id_usuario := 'USR-' || upper(substring(md5(random()::text || clock_timestamp()::text), 1, 8));

  insert into public.usuarios (id_usuario, nome, email, cargo, perfil, ativo_sistema, empresas_vinculadas)
  values (
    v_id_usuario, trim(p_nome), v_email_norm, nullif(trim(coalesce(p_cargo, '')), ''),
    p_perfil, coalesce(p_ativo_sistema, true),
    case when p_perfil = 'Tecnico' then coalesce(p_empresas_vinculadas, array[]::text[]) else array[]::text[] end
  );

  return jsonb_build_object('ok', true, 'id_usuario', v_id_usuario, 'auth_id', v_user_id);
exception
  when others then
    raise exception '%', sqlerrm;
end;
$function$;
