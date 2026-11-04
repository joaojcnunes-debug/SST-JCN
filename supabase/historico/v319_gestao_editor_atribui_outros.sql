-- v319 — Gestão: quem edita a lista pode pôr OUTRAS pessoas como responsável/seguidor (04/11/2026).
--
-- Até aqui (v195) só o gestor (owner/admin ou nível full na tarefa) vinculava outra pessoa;
-- quem só editava a lista vinculava a si mesmo. Decisão do João (04/11/2026): quem edita a lista
-- atribui qualquer MEMBRO da Gestão (Admin do sistema ou gestao_membros ativo). O piso continua
-- `gestao_pode_editar_q` e o log de vínculo continua igual. Junto vai a 0.3.223, em que a edição
-- na lista e a ação em massa passam a criar o vínculo (antes gravavam só o nome).
-- ANTES DE APLICAR: conferir que o corpo atual das duas funções no banco é o da v195.
-- Rollback: scripts/sql/v319_gestao_editor_atribui_outros_rollback.sql (corpos da v195).
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

  -- Piso: sem edição no quadro-pai, ninguém vincula.
  if not public.gestao_pode_editar_q(v_quadro) then
    raise exception 'sem edicao neste quadro';
  end if;

  -- v319: quem edita a lista vincula qualquer membro da Gestão; o gestor, qualquer e-mail (v195).
  v_eh_gestor := public.gestao_papel_de(v_ator) in ('owner','admin')
              or public.gestao_resolver_nivel(v_ator, 'task', p_id_tarefa) = 'full';
  if not v_eh_gestor and v_alvo <> lower(v_ator) and public.gestao_papel_de(v_alvo) is null then
    raise exception 'so membros da Gestao podem ser vinculados';
  end if;

  insert into public.gestao_tarefa_vinculados (id_tarefa, usuario_email, tipo, origem)
    values (p_id_tarefa, v_alvo, p_tipo, 'app')
  on conflict (id_tarefa, usuario_email, tipo) do nothing;

  insert into public.gestao_vinculo_log (ator_email, alvo_email, acao, tipo, id_tarefa)
    values (v_ator, v_alvo, 'vinculou', p_tipo, p_id_tarefa)
    returning id into v_log;

  return v_log;
end $$;

create or replace function public.gestao_desvincular(p_id_tarefa text, p_email text, p_tipo text)
  returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_ator text := public.gestao_email();
  v_alvo text := lower(btrim(coalesce(p_email, '')));
  v_quadro text;
  v_log uuid;
begin
  if v_ator is null then raise exception 'nao autenticado'; end if;
  if v_alvo = '' then raise exception 'e-mail do vinculo obrigatorio'; end if;
  if p_tipo not in ('responsavel','seguidor') then raise exception 'tipo invalido: %', p_tipo; end if;

  v_quadro := (select id_quadro from public.gestao_tarefas where id_tarefa = p_id_tarefa);
  if v_quadro is null then raise exception 'tarefa inexistente: %', p_id_tarefa; end if;

  -- v319: quem edita a lista também tira outras pessoas (simétrico ao vincular).
  if not public.gestao_pode_editar_q(v_quadro) then
    raise exception 'sem edicao neste quadro';
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
