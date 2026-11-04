-- Rollback da v319: devolve gestao_vincular/gestao_desvincular aos corpos da v195
-- (quem nao e gestor so vincula/desvincula a si mesmo). Corpos copiados de supabase/historico/v195_gestao_rpc_vinculo.sql.
begin;

create or replace function public.gestao_vincular(p_id_tarefa text, p_email text, p_tipo text)
  returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_ator text := public.gestao_email();
  v_alvo text := lower(btrim(coalesce(p_email, '')));
  v_quadro text;
  v_eh_gestor boolean;
  v_log uuid;
begin
  if v_ator is null then raise exception 'nao autenticado'; end if;
  if v_alvo = '' then raise exception 'e-mail do vinculo obrigatorio'; end if;
  if p_tipo not in ('responsavel','seguidor') then raise exception 'tipo invalido: %', p_tipo; end if;

  v_quadro := (select id_quadro from public.gestao_tarefas where id_tarefa = p_id_tarefa);
  if v_quadro is null then raise exception 'tarefa inexistente: %', p_id_tarefa; end if;

  -- Piso: sem edicao no quadro-pai, ninguem vincula (mesma pre-condicao de hoje).
  if not public.gestao_pode_editar_q(v_quadro) then
    raise exception 'sem edicao neste quadro';
  end if;

  -- Gestor = owner/admin OU nivel full na tarefa (Decisao 2). Comum so a si.
  v_eh_gestor := public.gestao_papel_de(v_ator) in ('owner','admin')
              or public.gestao_resolver_nivel(v_ator, 'task', p_id_tarefa) = 'full';
  if not v_eh_gestor and v_alvo <> lower(v_ator) then
    raise exception 'voce so pode vincular a si mesmo';
  end if;

  -- Escrita (bypassa RLS como definer). Trigger-espelho v187 reflete responsavel=NOME.
  insert into public.gestao_tarefa_vinculados (id_tarefa, usuario_email, tipo, origem)
    values (p_id_tarefa, v_alvo, p_tipo, 'app')
  on conflict (id_tarefa, usuario_email, tipo) do nothing;

  insert into public.gestao_vinculo_log (ator_email, alvo_email, acao, tipo, id_tarefa)
    values (v_ator, v_alvo, 'vinculou', p_tipo, p_id_tarefa)
    returning id into v_log;

  return v_log;
end $$;

-- (3) RPC gestao_desvincular — simetrico (Decisao 3). p_tipo p/ delta e log fieis. ─
create or replace function public.gestao_desvincular(p_id_tarefa text, p_email text, p_tipo text)
  returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_ator text := public.gestao_email();
  v_alvo text := lower(btrim(coalesce(p_email, '')));
  v_quadro text;
  v_eh_gestor boolean;
  v_log uuid;
begin
  if v_ator is null then raise exception 'nao autenticado'; end if;
  if v_alvo = '' then raise exception 'e-mail do vinculo obrigatorio'; end if;
  if p_tipo not in ('responsavel','seguidor') then raise exception 'tipo invalido: %', p_tipo; end if;

  v_quadro := (select id_quadro from public.gestao_tarefas where id_tarefa = p_id_tarefa);
  if v_quadro is null then raise exception 'tarefa inexistente: %', p_id_tarefa; end if;

  if not public.gestao_pode_editar_q(v_quadro) then
    raise exception 'sem edicao neste quadro';
  end if;

  v_eh_gestor := public.gestao_papel_de(v_ator) in ('owner','admin')
              or public.gestao_resolver_nivel(v_ator, 'task', p_id_tarefa) = 'full';
  if not v_eh_gestor and v_alvo <> lower(v_ator) then
    raise exception 'voce so pode desvincular a si mesmo';
  end if;

  delete from public.gestao_tarefa_vinculados
   where id_tarefa = p_id_tarefa and usuario_email = v_alvo and tipo = p_tipo;

  insert into public.gestao_vinculo_log (ator_email, alvo_email, acao, tipo, id_tarefa)
    values (v_ator, v_alvo, 'desvinculou', p_tipo, p_id_tarefa)
    returning id into v_log;

  return v_log;
end $$;

revoke execute on function public.gestao_vincular(text,text,text) from public, anon;
revoke execute on function public.gestao_desvincular(text,text,text) from public, anon;
grant execute on function public.gestao_vincular(text,text,text) to authenticated;
grant execute on function public.gestao_desvincular(text,text,text) to authenticated;

commit;
