-- Rollback do hotfix v234 (guardas NULL; registrada como v231_sec_gestao_guardas_null): REABRE o furo (não-membro autenticado vira owner via
-- gestao_definir_membro). Só use se o hotfix quebrar algo legítimo — e feche de novo em seguida.
-- NOTA: o revoke execute de gestao_definir_membro para public/anon (hotfix item 3) NÃO é desfeito aqui —
-- é hardening sem dependente; reabrir seria regressão.
begin;
create or replace function public.gestao_eh_gestor(p_email text) returns boolean
  language sql stable security definer set search_path=public as $$
  select public.gestao_papel_de(p_email) in ('owner','admin');
$$;

create or replace function public.gestao_definir_membro(p_alvo text, p_papel gestao_papel, p_ativo boolean, p_motivo text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_ator text := public.gestao_email(); v_ator_papel public.gestao_papel; v_ant public.gestao_papel; v_log uuid;
begin
  if length(trim(coalesce(p_motivo,''))) < 5 then raise exception 'motivo obrigatório (mínimo 5 caracteres)'; end if;
  v_ator_papel := public.gestao_papel_de(v_ator);
  if v_ator_papel not in ('owner','admin') then raise exception 'apenas Owner/Admin gerenciam o roster'; end if;
  select papel into v_ant from public.gestao_membros where lower(usuario_email)=lower(p_alvo);
  if v_ator_papel = 'admin' and (p_papel = 'owner' or v_ant = 'owner') then
    raise exception 'admin não promove/altera owner';
  end if;
  insert into public.gestao_membros (usuario_email, papel, ativo, adicionado_por)
    values (p_alvo, p_papel, coalesce(p_ativo, true), v_ator)
  on conflict (lower(usuario_email)) do update set papel=excluded.papel, ativo=excluded.ativo;
  insert into public.gestao_acesso_log (ator_email, alvo_email, acao, motivo)
    values (v_ator, p_alvo,
            (case when v_ant is null then 'convidou' when coalesce(p_ativo,true)=false then 'removeu' else 'alterou_papel' end)::public.gestao_acao,
            p_motivo)
    returning id into v_log;
  return v_log;
end $function$;
commit;
