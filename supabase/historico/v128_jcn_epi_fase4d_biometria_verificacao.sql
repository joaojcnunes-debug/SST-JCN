-- v128 (JCN) — EPI Fase 4D: verificação biométrica 1:1 (confronto de identidade).
-- Aplicado via MCP. Template do colaborador (FMD ISO/ANSI serializado em base64)
-- para comparação no companion local; resultado da verificação na assinatura.
-- LGPD: template é minutiae (não a imagem), sob RLS dual (v126); consentimento
-- de cadastro registrado. Supabase criptografa em repouso. Idempotente.

alter table public.epi_colaboradores
  add column if not exists biometria_template        text,
  add column if not exists biometria_cadastrada_em   timestamptz,
  add column if not exists biometria_consentimento_em timestamptz;

alter table public.epi_entrega_assinaturas
  add column if not exists verificado  boolean not null default false,
  add column if not exists match_score integer;

drop function if exists public.epi_assinar_entrega(text,text,text,text,text,text,text,text,text,boolean);

create or replace function public.epi_assinar_entrega(
  p_id_entrega text, p_assinante_nome text, p_assinatura_png text,
  p_pdf_sha256 text, p_user_agent text,
  p_metodo text default 'canvas', p_finger_hash text default null,
  p_device_info text default null, p_qualidade text default null,
  p_consentimento boolean default false,
  p_verificado boolean default false, p_match_score integer default null
) returns text language plpgsql security definer set search_path=public as $fn$
declare
  v_email   text := auth.jwt() ->> 'email';
  v_id      text := gen_random_uuid()::text;
  v_empresa text; v_colab text; v_ip text;
begin
  select empresa_id, id_colaborador into v_empresa, v_colab
    from public.epi_entregas where id = p_id_entrega;
  if v_empresa is null then
    raise exception 'entrega não encontrada';
  end if;
  if not (public.caller_pode_editar() or v_empresa = any(public.get_minhas_empresas())) then
    raise exception 'sem permissão para assinar esta entrega';
  end if;

  if p_metodo = 'digital' then
    if p_finger_hash is null or length(p_finger_hash) < 32 then
      raise exception 'captura biométrica ausente';
    end if;
    if not p_consentimento then
      raise exception 'consentimento LGPD é obrigatório para assinatura biométrica';
    end if;
  else
    if p_assinatura_png is null or length(p_assinatura_png) < 100 then
      raise exception 'assinatura ausente';
    end if;
  end if;

  begin
    v_ip := coalesce(
      nullif(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1), ''),
      current_setting('request.headers', true)::json->>'x-real-ip'
    );
  exception when others then
    v_ip := null;
  end;

  insert into public.epi_entrega_assinaturas
    (id, id_entrega, empresa_id, id_colaborador, assinante_nome, assinatura_png, pdf_sha256, user_agent, ip, criado_por,
     metodo, finger_hash, device_info, qualidade, consentimento_em, verificado, match_score)
  values
    (v_id, p_id_entrega, v_empresa, v_colab, p_assinante_nome, p_assinatura_png, p_pdf_sha256, p_user_agent, v_ip, v_email,
     coalesce(p_metodo, 'canvas'), p_finger_hash, p_device_info, p_qualidade,
     case when p_consentimento then now() else null end,
     coalesce(p_verificado, false), p_match_score);

  return v_id;
end $fn$;

grant execute on function public.epi_assinar_entrega(text,text,text,text,text,text,text,text,text,boolean,boolean,integer) to authenticated;
