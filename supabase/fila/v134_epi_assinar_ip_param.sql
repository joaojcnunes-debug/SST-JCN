-- v134 — Gestão de EPI (biometria): epi_assinar_entrega aceita o IP explícito.
--
-- No caminho DIGITAL, a assinatura é gravada pelo SERVIDOR (endpoint /verificar), após o
-- match — então o request.headers vê o IP do app, não do usuário. p_ip permite passar o
-- IP real do usuário (lido pelo endpoint). No caminho DESENHO (cliente chama direto), p_ip
-- vem null e mantém-se a captura via request.headers. Idempotente/reversível.

drop function if exists public.epi_assinar_entrega(text, text, text, text, text, boolean, text, numeric, boolean);
create or replace function public.epi_assinar_entrega(
  p_id_entrega text, p_assinante_nome text, p_assinatura_png text,
  p_pdf_sha256 text, p_user_agent text, p_consentimento boolean,
  p_metodo text default 'canvas', p_match_score numeric default null,
  p_finger_verificado boolean default null, p_ip text default null
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

  v_ip := nullif(trim(coalesce(p_ip, '')), '');
  if v_ip is null then
    begin
      v_ip := coalesce(
        nullif(split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1), ''),
        current_setting('request.headers', true)::json ->> 'x-real-ip');
    exception when others then v_ip := null;
    end;
  end if;

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

grant execute on function public.epi_assinar_entrega(text, text, text, text, text, boolean, text, numeric, boolean, text) to authenticated;
