-- ============================================================
-- V12: RPCs admin pra gerenciar usuários (email/senha/exclusão)
-- ============================================================
-- Funções SECURITY DEFINER que rodam com privilégios elevados pra
-- modificar auth.users (tabela protegida por RLS interno do Supabase).
-- Cada função verifica primeiro que o caller é Admin antes de agir.
--
-- Idempotente (CREATE OR REPLACE).
-- ============================================================

-- Helper: caller atual é Admin ativo?
CREATE OR REPLACE FUNCTION public.is_admin_caller()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.email = lower(coalesce(auth.jwt() ->> 'email', ''))
      AND u.perfil = 'Admin'
      AND u.ativo_sistema = true
  );
$$;


-- 1) Atualizar email no auth.users + sincronizar identities + public.usuarios
CREATE OR REPLACE FUNCTION public.atualizar_email_admin(
  p_email_antigo text,
  p_email_novo text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT public.is_admin_caller() THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar e-mails de outros usuários';
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = lower(p_email_antigo);

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado no Auth (email: %)', p_email_antigo;
  END IF;

  -- Verifica se o novo email já está em uso
  IF EXISTS (
    SELECT 1 FROM auth.users WHERE email = lower(p_email_novo) AND id <> v_user_id
  ) THEN
    RAISE EXCEPTION 'O e-mail % já está cadastrado em outro usuário', p_email_novo;
  END IF;

  -- Atualiza auth.users
  UPDATE auth.users
  SET email = lower(p_email_novo),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
  WHERE id = v_user_id;

  -- Atualiza identities (provider='email')
  UPDATE auth.identities
  SET identity_data = jsonb_set(identity_data, '{email}', to_jsonb(lower(p_email_novo))),
      updated_at = now()
  WHERE user_id = v_user_id AND provider = 'email';

  -- Atualiza espelho em public.usuarios
  UPDATE public.usuarios
  SET email = lower(p_email_novo)
  WHERE email = lower(p_email_antigo);
END;
$$;


-- 2) Redefinir senha (admin define nova senha pra outro usuário)
CREATE OR REPLACE FUNCTION public.redefinir_senha_admin(
  p_email text,
  p_nova_senha text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT public.is_admin_caller() THEN
    RAISE EXCEPTION 'Apenas administradores podem redefinir senhas';
  END IF;

  IF char_length(p_nova_senha) < 6 THEN
    RAISE EXCEPTION 'A senha deve ter no mínimo 6 caracteres';
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = lower(p_email);

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado no Auth (email: %)', p_email;
  END IF;

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_nova_senha, extensions.gen_salt('bf')),
      updated_at = now()
  WHERE id = v_user_id;
END;
$$;


-- 3) Excluir usuário (apaga auth.users + public.usuarios — cascade nas identities)
CREATE OR REPLACE FUNCTION public.excluir_usuario_admin(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_caller_email text;
BEGIN
  IF NOT public.is_admin_caller() THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir usuários';
  END IF;

  v_caller_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF v_caller_email = lower(p_email) THEN
    RAISE EXCEPTION 'Você não pode excluir o próprio usuário';
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = lower(p_email);

  -- Exclui o registro do espelho público primeiro
  DELETE FROM public.usuarios WHERE email = lower(p_email);

  -- Exclui do auth (identities saem por cascade)
  IF v_user_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = v_user_id;
  END IF;
END;
$$;


-- Permissões: authenticated pode invocar (a função verifica admin internamente)
GRANT EXECUTE ON FUNCTION public.is_admin_caller() TO authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_email_admin(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redefinir_senha_admin(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_usuario_admin(text) TO authenticated;
