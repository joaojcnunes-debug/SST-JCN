-- v351 — Google Agenda: o evento leva o texto do cartão e, na subtarefa (visita), o do cartão original (12/11/2026, 0.3.283).
--
-- Trazida da v365 do Painel (0.3.943). O corpo anterior de gestao_google_enfileirar_trg no JCN era igual ao do Painel
-- antes da v365 (conferido em 12/11).
-- 1) gestao_google_enfileirar_trg: mudar a DESCRIÇÃO também reenvia o evento; e mudar a descrição de uma tarefa reenvia
--    o evento das subtarefas dela que têm data (elas mostram o cartão original).
-- 2) gestao_google_ve_tarefa(email, tarefa): a pessoa pode ver a tarefa? A mesma régua da RLS (gestao_ve_tarefa), para a
--    rota de sincronização (service_role) só pôr o cartão original na agenda de quem pode abri-lo.
-- 3) Reenvia uma vez os eventos do sistema de ontem em diante, para eles ganharem o texto.
--
-- REAPLICAR: idempotente (o reenvio só enfileira). ROLLBACK: scripts/sql/v351_gestao_google_descricao_rollback.sql

begin;

create or replace function public.gestao_google_enfileirar_trg()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_id text; v_op text;
begin
  -- Guarda anti-loop (forward-compat F3.B): escrita de reflexo do próprio sync não re-enfileira.
  if coalesce(current_setting('gestao.in_google_sync', true), '') = 'on' then
    return null;
  end if;

  if tg_table_name = 'gestao_tarefas' then
    if tg_op = 'DELETE' then
      v_id := old.id_tarefa; v_op := 'delete';
    elsif tg_op = 'INSERT' then
      if new.prazo is null then return null; end if;      -- sem prazo → nada a agendar
      v_id := new.id_tarefa; v_op := 'upsert';
    else -- UPDATE
      if new.prazo is not distinct from old.prazo
         and new.data_inicio is not distinct from old.data_inicio
         and new.hora_inicio is not distinct from old.hora_inicio
         and new.hora_fim is not distinct from old.hora_fim
         and new.titulo is not distinct from old.titulo
         and new.status is not distinct from old.status
         and new.descricao is not distinct from old.descricao then
        return null;                                       -- nada relevante mudou
      end if;
      v_id := new.id_tarefa; v_op := 'upsert';
      -- v365: a descrição desta tarefa aparece no evento das subtarefas dela que têm data.
      if new.descricao is distinct from old.descricao then
        insert into public.gestao_google_fila (id_tarefa, operacao)
        select f.id_tarefa, 'upsert' from public.gestao_tarefas f
         where f.id_tarefa_pai = new.id_tarefa and f.prazo is not null;
      end if;
    end if;
  else -- gestao_tarefa_vinculados: enfileira a tarefa-mãe (reconcilia a lista de convidados)
    v_id := coalesce(new.id_tarefa, old.id_tarefa); v_op := 'upsert';
  end if;

  insert into public.gestao_google_fila (id_tarefa, operacao) values (v_id, v_op);
  return null;
end $function$;

create or replace function public.gestao_google_ve_tarefa(p_email text, p_id_tarefa text)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_antes text; v_ok boolean;
begin
  if p_email is null or p_id_tarefa is null then return false; end if;
  v_antes := current_setting('request.jwt.claims', true);
  perform set_config('request.jwt.claims', json_build_object('email', lower(p_email), 'role', 'authenticated')::text, true);
  v_ok := coalesce(public.gestao_ve_tarefa(p_id_tarefa), false);
  -- auth.jwt() faz ::jsonb do valor: vazio quebraria a consulta seguinte, então volta '{}' se não havia nada.
  perform set_config('request.jwt.claims', coalesce(nullif(v_antes, ''), '{}'), true);
  return v_ok;
end $function$;

revoke all on function public.gestao_google_ve_tarefa(text, text) from public, anon, authenticated;
grant execute on function public.gestao_google_ve_tarefa(text, text) to service_role;

insert into public.gestao_google_fila (id_tarefa, operacao)
select distinct e.id_tarefa, 'upsert'
  from public.gestao_google_eventos e
  join public.gestao_tarefas t using (id_tarefa)
 where e.origem = 'painel' and t.prazo >= current_date - 1;

notify pgrst, 'reload schema';

commit;
