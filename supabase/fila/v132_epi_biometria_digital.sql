-- v132 — Gestão de EPI (Fase 4B): biometria digital (cadastro + verificação na assinatura).
--
-- O colaborador cadastra a 1ª digital (enroll) e, ao assinar a ficha, faz-se a verificação
-- 1:1 (para outra pessoa não assinar no lugar dele). O MATCH é feito no cliente (helper
-- nativo DigitalPersona no app desktop); o servidor guarda o template CIFRADO (pgcrypto)
-- e registra o resultado (metodo='digital', match_score, finger_verificado).
--
-- LGPD: template = dado pessoal SENSÍVEL → cifrado com pgp_sym_encrypt usando a chave
-- `app.epi_bio_key` (definir no .107: ALTER DATABASE painel_sst SET app.epi_bio_key='<segredo>').
-- Sem a chave, o enroll é bloqueado com erro claro. Consentimento específico obrigatório.
-- Idempotente/reversível.

create extension if not exists pgcrypto;

-- colaborador: template cifrado + carimbos
alter table public.epi_colaboradores
  add column if not exists biometria_template          text,        -- FMD cifrado (pgp_sym, base64)
  add column if not exists biometria_em                timestamptz,
  add column if not exists biometria_consentimento_em  timestamptz;

-- assinatura: campos da verificação digital (metodo já existe na v130)
alter table public.epi_entrega_assinaturas
  add column if not exists match_score       numeric,
  add column if not exists finger_verificado boolean;

-- chave de cifra (do setting; null se não configurada)
create or replace function public.epi_bio_key()
returns text language sql stable set search_path = public as $$
  select nullif(current_setting('app.epi_bio_key', true), '');
$$;

-- ── Enroll: cadastra/atualiza a biometria do colaborador ─────────────────────
create or replace function public.epi_cadastrar_biometria(
  p_id_colaborador text, p_template text, p_consentimento boolean
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_emp text; v_key text := public.epi_bio_key();
begin
  if not public.caller_pode_editar() then raise exception 'Sem permissão para cadastrar biometria.'; end if;
  select empresa_id into v_emp from epi_colaboradores where id = p_id_colaborador;
  if not found then raise exception 'Colaborador não encontrado.'; end if;
  if not public.caller_pode_ver_empresa(v_emp) then raise exception 'Empresa fora do seu acesso.'; end if;
  if not coalesce(p_consentimento, false) then raise exception 'Consentimento biométrico é obrigatório.'; end if;
  if coalesce(trim(p_template), '') = '' then raise exception 'Template biométrico vazio.'; end if;
  if v_key is null then raise exception 'Chave de biometria não configurada (defina app.epi_bio_key no banco).'; end if;

  update epi_colaboradores
    set biometria_template = encode(pgp_sym_encrypt(p_template, v_key), 'base64'),
        biometria_em = now(),
        biometria_consentimento_em = now(),
        updated_at = now()
  where id = p_id_colaborador;
end $$;

-- ── Obter template (decifrado) para comparar no cliente ──────────────────────
create or replace function public.epi_obter_biometria(p_id_colaborador text)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_emp text; v_enc text; v_key text := public.epi_bio_key();
begin
  if not public.caller_pode_editar() then raise exception 'Sem permissão.'; end if;
  select empresa_id, biometria_template into v_emp, v_enc from epi_colaboradores where id = p_id_colaborador;
  if not found then raise exception 'Colaborador não encontrado.'; end if;
  if not public.caller_pode_ver_empresa(v_emp) then raise exception 'Empresa fora do seu acesso.'; end if;
  if v_enc is null then return null; end if;
  if v_key is null then raise exception 'Chave de biometria não configurada.'; end if;
  return pgp_sym_decrypt(decode(v_enc, 'base64'), v_key);
end $$;

-- ── Assinar entrega (agora com metodo digital + verificação) ─────────────────
drop function if exists public.epi_assinar_entrega(text, text, text, text, text, boolean);
create or replace function public.epi_assinar_entrega(
  p_id_entrega text, p_assinante_nome text, p_assinatura_png text,
  p_pdf_sha256 text, p_user_agent text, p_consentimento boolean,
  p_metodo text default 'canvas', p_match_score numeric default null, p_finger_verificado boolean default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_email text := auth.jwt() ->> 'email';
  v_empresa text; v_colab text; v_ip text; v_id text := gen_random_uuid()::text;
  v_metodo text := coalesce(nullif(p_metodo, ''), 'canvas');
begin
  if not public.caller_pode_editar() then raise exception 'Sem permissão para assinar.'; end if;
  select empresa_id, id_colaborador into v_empresa, v_colab from epi_entregas where id = p_id_entrega;
  if not found then raise exception 'Entrega não encontrada.'; end if;
  if not public.caller_pode_ver_empresa(v_empresa) then raise exception 'Empresa fora do seu acesso.'; end if;
  if not coalesce(p_consentimento, false) then raise exception 'É necessário o consentimento do recebedor.'; end if;

  if v_metodo = 'digital' then
    if not coalesce(p_finger_verificado, false) then raise exception 'Verificação biométrica não confirmada.'; end if;
  else
    if coalesce(trim(p_assinatura_png), '') = '' then raise exception 'Assinatura em branco.'; end if;
  end if;

  begin
    v_ip := coalesce(
      nullif(split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1), ''),
      current_setting('request.headers', true)::json ->> 'x-real-ip');
  exception when others then v_ip := null;
  end;

  insert into public.epi_entrega_assinaturas
    (id, id_entrega, empresa_id, id_colaborador, assinante_nome, metodo, assinatura_png, pdf_sha256,
     user_agent, ip, consentimento_em, match_score, finger_verificado, criado_por)
  values
    (v_id, p_id_entrega, v_empresa, v_colab,
     coalesce(nullif(trim(p_assinante_nome), ''), (select nome from epi_colaboradores where id = v_colab)),
     v_metodo, p_assinatura_png, p_pdf_sha256, p_user_agent, v_ip, now(),
     p_match_score, case when v_metodo = 'digital' then coalesce(p_finger_verificado, false) else null end, v_email);

  return v_id;
end $$;

grant execute on function public.epi_bio_key() to authenticated;
grant execute on function public.epi_cadastrar_biometria(text, text, boolean) to authenticated;
grant execute on function public.epi_obter_biometria(text) to authenticated;
grant execute on function public.epi_assinar_entrega(text, text, text, text, text, boolean, text, numeric, boolean) to authenticated;
