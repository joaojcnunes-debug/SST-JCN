-- v201_gestao_automacoes_v2_nucleo.rollback.sql
-- Reverte GESTAO-KANBAN-01-F2.2a ao motor v120 VERBATIM (corpo capturado por pg_get_functiondef):
--   - restaura run(4-arg)/aplicar/trg/prazos com o booleano gestao.in_automacao;
--   - remove o gatilho novo subtarefa_concluida e a função associada;
--   - restaura o WHEN de trg_gestao_automacao_upd (só status);
--   - dropa a coluna gestao_automacao_log.profundidade;
--   - remove o registro em schema_migrations.
-- (migrate.ps1 pula arquivo com "rollback" no nome — aplicar à mão.)

begin;

-- ---- remover extensões de gatilho da F2.2a ----
drop trigger if exists gestao_subtarefa_autom_trg on public.gestao_subtarefas;
drop function if exists public.gestao_subtarefa_autom_trg();

-- ---- restaurar run: dropar a versão 5-arg (F2.2a) e recriar a 4-arg (v120) ----
drop function if exists public.gestao_automacao_run(text, text, text, text, jsonb);

create or replace function public.gestao_automacao_run(p_id_tarefa text, p_gatilho text, p_de text, p_para text)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $fn$
declare v_tarefa public.gestao_tarefas; a public.gestao_automacoes;
begin
  select * into v_tarefa from public.gestao_tarefas where id_tarefa = p_id_tarefa;
  if not found then return; end if;

  perform set_config('gestao.in_automacao', 'on', true);   -- não re-disparar via ações
  for a in
    select * from public.gestao_automacoes
    where id_quadro = v_tarefa.id_quadro and ativo and gatilho = p_gatilho
    order by ordem
  loop
    if p_gatilho = 'status_muda' then
      if (a.condicao->>'de')   is not null and a.condicao->>'de'   <> coalesce(p_de,'')   then continue; end if;
      if (a.condicao->>'para') is not null and a.condicao->>'para' <> coalesce(p_para,'') then continue; end if;
    end if;
    perform public.gestao_automacao_aplicar(a, v_tarefa, p_gatilho);
    select * into v_tarefa from public.gestao_tarefas where id_tarefa = p_id_tarefa;  -- reflete mudanças
  end loop;
  perform set_config('gestao.in_automacao', 'off', true);
end
$fn$;

-- ---- restaurar aplicar (v120) ----
create or replace function public.gestao_automacao_aplicar(p_autom gestao_automacoes, p_tarefa gestao_tarefas, p_gatilho text)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $fn$
declare
  v_acao jsonb := coalesce(p_autom.acao, '{}'::jsonb);
  v_tipo text := v_acao->>'tipo';
  v_email text; v_res text := 'ok'; v_det text := null;
begin
  begin
    if v_tipo = 'mover_status' and coalesce(v_acao->>'valor','') <> '' then
      update public.gestao_tarefas set status = v_acao->>'valor', updated_at = now() where id_tarefa = p_tarefa.id_tarefa;
    elsif v_tipo = 'definir_responsavel' then
      update public.gestao_tarefas set responsavel = nullif(v_acao->>'valor',''), updated_at = now() where id_tarefa = p_tarefa.id_tarefa;
    elsif v_tipo = 'definir_prioridade' and coalesce(v_acao->>'valor','') <> '' then
      update public.gestao_tarefas set prioridade = v_acao->>'valor', updated_at = now() where id_tarefa = p_tarefa.id_tarefa;
    elsif v_tipo = 'definir_campo' and coalesce(v_acao->>'campo_id','') <> '' then
      update public.gestao_tarefas
        set campos = jsonb_set(coalesce(campos,'{}'::jsonb), array[v_acao->>'campo_id'], coalesce(to_jsonb(v_acao->>'valor'), 'null'::jsonb)),
            updated_at = now()
        where id_tarefa = p_tarefa.id_tarefa;
    elsif v_tipo = 'notificar' then
      select email into v_email from public.usuarios where nome = p_tarefa.responsavel limit 1;
      if v_email is null then
        v_res := 'skip'; v_det := 'sem responsável/e-mail';
      elsif p_gatilho like 'prazo%' and exists (
        select 1 from public.gestao_notificacoes n
        where n.id_tarefa = p_tarefa.id_tarefa and n.tipo = 'prazo' and n.created_at::date = current_date
      ) then
        v_res := 'skip'; v_det := 'notificação de prazo já enviada hoje';
      else
        insert into public.gestao_notificacoes (id, destinatario, tipo, titulo, id_tarefa, id_quadro)
        values (gen_random_uuid(), v_email,
                case when p_gatilho like 'prazo%' then 'prazo' else 'status' end,
                coalesce(nullif(v_acao->>'valor',''), 'Automação: ' || p_tarefa.titulo),
                p_tarefa.id_tarefa, p_tarefa.id_quadro);
      end if;
    else
      v_res := 'skip'; v_det := 'ação não reconhecida: ' || coalesce(v_tipo,'(vazia)');
    end if;
  exception when others then
    v_res := 'erro'; v_det := left(SQLERRM, 300);
  end;

  insert into public.gestao_automacao_log (id_automacao, id_tarefa, gatilho, resultado, detalhe)
    values (p_autom.id, p_tarefa.id_tarefa, p_gatilho, v_res, v_det);
end
$fn$;

-- ---- restaurar trg (v120, com in_automacao) ----
create or replace function public.gestao_automacao_trg()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $fn$
begin
  if coalesce(current_setting('gestao.in_automacao', true), '') = 'on' then return null; end if;  -- ação de automação: não recursa
  begin
    if tg_op = 'INSERT' then
      perform public.gestao_automacao_run(new.id_tarefa, 'tarefa_criada', null, null);
    elsif tg_op = 'UPDATE' then
      perform public.gestao_automacao_run(new.id_tarefa, 'status_muda', old.status, new.status);
    end if;
  exception when others then
    perform set_config('gestao.in_automacao', 'off', true);
    insert into public.gestao_automacao_log (id_tarefa, gatilho, resultado, detalhe)
      values (new.id_tarefa, tg_op, 'erro', left(SQLERRM, 300));  -- nunca falha o save do usuário
  end;
  return null;
end
$fn$;

-- ---- restaurar WHEN original de trg_gestao_automacao_upd (só status) ----
drop trigger if exists trg_gestao_automacao_upd on public.gestao_tarefas;
create trigger trg_gestao_automacao_upd
  after update on public.gestao_tarefas
  for each row
  when (old.status is distinct from new.status)
  execute function public.gestao_automacao_trg();

-- ---- restaurar prazos (v120, com in_automacao) ----
create or replace function public.gestao_automacao_prazos()
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $fn$
declare a public.gestao_automacoes; t public.gestao_tarefas; v_dias int;
begin
  perform set_config('gestao.in_automacao', 'on', true);
  for a in
    select * from public.gestao_automacoes
    where ativo and gatilho in ('prazo_proximo','prazo_vencido')
    order by ordem
  loop
    v_dias := coalesce((a.condicao->>'dias_antes')::int, 3);
    for t in
      select tk.* from public.gestao_tarefas tk
      left join public.gestao_status s on s.id_quadro = tk.id_quadro and s.slug = tk.status
      where tk.id_quadro = a.id_quadro
        and tk.prazo is not null
        and coalesce(s.tipo, 'ativo') <> 'concluido'
        and (
          (a.gatilho = 'prazo_proximo' and current_date >= (tk.prazo - v_dias) and current_date <= tk.prazo)
          or (a.gatilho = 'prazo_vencido' and tk.prazo < current_date)
        )
        -- dedup: cada automação dispara uma vez por tarefa
        and not exists (
          select 1 from public.gestao_automacao_log l
          where l.id_automacao = a.id and l.id_tarefa = tk.id_tarefa and l.gatilho = a.gatilho and l.resultado <> 'erro'
        )
    loop
      perform public.gestao_automacao_aplicar(a, t, a.gatilho);
    end loop;
  end loop;
  perform set_config('gestao.in_automacao', 'off', true);
end
$fn$;

-- ---- remover funções de condição E/OU da F2.2a ----
drop function if exists public.gestao_automacao_cond_bate(jsonb, jsonb);
drop function if exists public.gestao_automacao_cond_teste(jsonb, jsonb);

-- ---- dropar coluna nova do log ----
alter table public.gestao_automacao_log drop column if exists profundidade;

-- ---- remover registro de migration ----
delete from schema_migrations where version = 'v201_gestao_automacoes_v2_nucleo';

commit;
