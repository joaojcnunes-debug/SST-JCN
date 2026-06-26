-- V97 — Gestão Chabra: recorrência de tarefas + agendador (pg_cron)
-- Função diária: gera instâncias recorrentes vencidas e notifica prazos (hoje/atrasado).

alter table public.gestao_tarefas add column if not exists recorrencia jsonb;  -- {tipo,intervalo,proxima_geracao}

create extension if not exists pg_cron;

create or replace function public.gestao_cron_diario() returns void
language plpgsql security definer set search_path=public as $$
declare
  r record;
  v_novo text;
  v_status text;
  v_base date;
  v_int int;
  v_prox date;
begin
  -- 1) Recorrência: gera instâncias vencidas (clona o template e avança proxima_geracao)
  for r in
    select * from public.gestao_tarefas
    where recorrencia is not null
      and (recorrencia->>'proxima_geracao') is not null
      and (recorrencia->>'proxima_geracao')::date <= current_date
  loop
    select slug into v_status from public.gestao_status
      where id_quadro = r.id_quadro and tipo = 'nao_iniciado' order by ordem asc limit 1;
    if v_status is null then v_status := 'A_FAZER'; end if;

    v_novo := 'TRF-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    insert into public.gestao_tarefas (id_tarefa, id_quadro, titulo, descricao, status, prioridade, responsavel, prazo, ordem, etiquetas, subtarefas, campos, created_at)
    values (v_novo, r.id_quadro, r.titulo, r.descricao, v_status, r.prioridade, r.responsavel,
            (r.recorrencia->>'proxima_geracao')::date, 0, r.etiquetas, '[]'::jsonb, coalesce(r.campos,'{}'::jsonb), now());

    v_base := (r.recorrencia->>'proxima_geracao')::date;
    v_int  := coalesce((r.recorrencia->>'intervalo')::int, 1);
    if r.recorrencia->>'tipo' = 'semanal' then v_prox := v_base + (v_int * 7);
    elsif r.recorrencia->>'tipo' = 'mensal' then v_prox := (v_base + (v_int * interval '1 month'))::date;
    else v_prox := v_base + v_int;  -- diaria
    end if;

    update public.gestao_tarefas
      set recorrencia = jsonb_set(recorrencia, '{proxima_geracao}', to_jsonb(v_prox::text))
      where id_tarefa = r.id_tarefa;

    insert into public.gestao_atividades (id, ator, acao, id_tarefa, payload)
      values (gen_random_uuid(), 'cron', 'recorrencia_gerada', v_novo, jsonb_build_object('origem', r.id_tarefa));
  end loop;

  -- 2) Notificações de prazo (hoje/atrasado) para o responsável (sem duplicar no dia)
  insert into public.gestao_notificacoes (id, destinatario, tipo, titulo, id_tarefa, id_quadro)
  select gen_random_uuid(), u.email, 'prazo',
         case when t.prazo < current_date then 'Tarefa atrasada: ' else 'Vence hoje: ' end || t.titulo,
         t.id_tarefa, t.id_quadro
  from public.gestao_tarefas t
  join public.usuarios u on u.nome = t.responsavel
  left join public.gestao_status s on s.id_quadro = t.id_quadro and s.slug = t.status
  where t.prazo is not null
    and t.prazo <= current_date
    and coalesce(s.tipo, 'ativo') <> 'concluido'
    and u.email is not null
    and not exists (
      select 1 from public.gestao_notificacoes n
      where n.id_tarefa = t.id_tarefa and n.tipo = 'prazo' and n.created_at::date = current_date
    );
end $$;

-- Agendamento diário às 06:05 (cron.schedule faz upsert por nome no pg_cron 1.4+)
select cron.schedule('gestao-diario', '5 6 * * *', $$select public.gestao_cron_diario()$$);
