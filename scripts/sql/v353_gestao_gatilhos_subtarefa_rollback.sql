-- ROLLBACK v353 — volta prazos, relógio e subtarefa_concluida às definições da produção de 11/11 (antes da v353)
-- e tira o gatilho de eventos da subtarefa e a função de ctx.
-- Regras que usarem os gatilhos novos ficam no banco mas param de disparar (desligue-as antes, se houver).
begin;

CREATE OR REPLACE FUNCTION public.gestao_automacao_prazos()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.gestao_automacoes; t public.gestao_tarefas; v_dias int; v_depth int; v_ctx jsonb;
begin
  v_depth := coalesce(nullif(current_setting('gestao.autom_depth', true), ''), '0')::int;
  perform set_config('gestao.autom_depth', (v_depth + 1)::text, true);
  for a in select * from public.gestao_automacoes where ativo and gatilho in ('prazo_proximo','prazo_vencido') order by ordem loop
    v_dias := coalesce(nullif(a.condicao->>'dias_antes', '')::int, 3);
    for t in
      select tk.* from public.gestao_tarefas tk
        left join public.gestao_status s on s.id_quadro = tk.id_quadro and s.slug = tk.status
       where tk.id_quadro = a.id_quadro and tk.prazo is not null and tk.id_tarefa_pai is null
         and coalesce(s.tipo, 'ativo') <> 'concluido'
         and ((a.gatilho = 'prazo_proximo' and current_date >= (tk.prazo - v_dias) and current_date <= tk.prazo)
              or (a.gatilho = 'prazo_vencido' and tk.prazo < current_date))
         and not exists (select 1 from public.gestao_automacao_log l
                          where l.id_automacao = a.id and l.id_tarefa = tk.id_tarefa and l.gatilho = a.gatilho and l.resultado <> 'erro')
    loop
      v_ctx := public.gestao_automacao_ctx(t, '{}'::jsonb);
      if ((a.condicao ? 'all') or (a.condicao ? 'any')) and not public.gestao_automacao_cond_bate(a.condicao, v_ctx) then
        continue;
      end if;
      perform public.gestao_automacao_aplicar(a, t, a.gatilho, v_ctx);
    end loop;
  end loop;
  perform set_config('gestao.autom_depth', v_depth::text, true);
exception when others then
  perform set_config('gestao.autom_depth', coalesce(v_depth, 0)::text, true);
end $function$;

CREATE OR REPLACE FUNCTION public.gestao_automacao_relogio()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_agora timestamp := now() at time zone 'America/Sao_Paulo';
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  a public.gestao_automacoes; t public.gestao_tarefas; e record; v_ctx jsonb; v_n int;
  v_esperas int := 0; v_agenda int := 0; v_paradas int := 0; v_inicios int := 0;
  v_ref timestamptz; v_lim interval; v_chave text; v_depth int;
begin
  if not pg_try_advisory_xact_lock(hashtext('gestao_automacao_relogio')) then
    return jsonb_build_object('rodou', false, 'motivo', 'em execução');
  end if;
  -- no máximo a cada 5 minutos (o worker chama a cada minuto)
  if exists (select 1 from public.gestao_automacao_log where gatilho = 'relogio' and created_at > now() - interval '5 minutes') then
    return jsonb_build_object('rodou', false, 'motivo', 'rodou há menos de 5 min');
  end if;
  delete from public.gestao_automacao_log where gatilho = 'relogio' and created_at < now() - interval '1 day';
  insert into public.gestao_automacao_log (gatilho, resultado, detalhe) values ('relogio', 'ok', 'tick');
  v_depth := coalesce(nullif(current_setting('gestao.autom_depth', true), ''), '0')::int;
  perform set_config('gestao.autom_depth', (v_depth + 1)::text, true);

  -- 1) esperas vencidas
  for e in
    select w.* from public.gestao_automacao_esperas w
     where w.executado_em is null and w.executar_em <= now()
     order by w.executar_em limit 200 for update skip locked
  loop
    update public.gestao_automacao_esperas set executado_em = now() where id = e.id;
    select * into a from public.gestao_automacoes where id = e.id_automacao and ativo;
    if not found then continue; end if;
    select * into t from public.gestao_tarefas where id_tarefa = e.id_tarefa;
    if not found then continue; end if;
    perform public.gestao_automacao_executar(a, e.acoes, t, e.gatilho, public.gestao_automacao_ctx(t, e.ctx), null, 'após a espera');
    v_esperas := v_esperas + 1;
  end loop;

  -- 2) agenda
  for a in select * from public.gestao_automacoes where ativo and gatilho = 'agendado' order by ordem loop
    if not public.gestao_agenda_devida(a.condicao->'agenda', v_agora) then continue; end if;
    v_chave := 'agenda:' || v_hoje;
    if exists (select 1 from public.gestao_automacao_log l where l.id_automacao = a.id and l.id_tarefa is null and l.chave = v_chave) then
      continue;
    end if;
    v_n := 0;
    if coalesce(a.condicao->>'modo', 'cada_tarefa') = 'criar_tarefa' then
      v_ctx := jsonb_build_object('vars', jsonb_build_object('data', public.gestao_data_br(v_hoje)));
      t := public.gestao_automacao_criar_tarefa(a, a.condicao->'modelo_tarefa', v_ctx);
      perform public.gestao_automacao_executar(a, a.acoes, t, 'agendado', public.gestao_automacao_ctx(t, v_ctx), v_chave, 'tarefa criada pela agenda');
      v_n := 1;
    else
      for t in
        select tk.* from public.gestao_tarefas tk
          left join public.gestao_status s on s.id_quadro = tk.id_quadro and s.slug = tk.status
         where tk.id_quadro = a.id_quadro and tk.id_tarefa_pai is null and coalesce(s.tipo, 'ativo') <> 'concluido'
         order by tk.created_at limit 500
      loop
        v_ctx := public.gestao_automacao_ctx(t, '{}'::jsonb);
        if ((a.condicao ? 'all') or (a.condicao ? 'any')) and not public.gestao_automacao_cond_bate(a.condicao, v_ctx) then continue; end if;
        perform public.gestao_automacao_executar(a, a.acoes, t, 'agendado', v_ctx, v_chave);
        v_n := v_n + 1;
      end loop;
    end if;
    insert into public.gestao_automacao_log (id_automacao, gatilho, resultado, detalhe, chave)
    values (a.id, 'agendado', 'ok', 'agenda de ' || public.gestao_data_br(v_hoje) || ': ' || v_n || ' tarefa(s)', v_chave);
    v_agenda := v_agenda + 1;
  end loop;

  -- 3) tarefa parada / tempo no status (SLA)
  for a in select * from public.gestao_automacoes where ativo and gatilho = 'tarefa_parada' order by ordem loop
    v_lim := case when a.condicao->'parada'->>'unidade' = 'horas'
                  then make_interval(hours => coalesce(nullif(a.condicao->'parada'->>'quantidade', '')::int, 1))
                  else make_interval(days => coalesce(nullif(a.condicao->'parada'->>'quantidade', '')::int, 1)) end;
    for t in
      select tk.* from public.gestao_tarefas tk
        left join public.gestao_status s on s.id_quadro = tk.id_quadro and s.slug = tk.status
       where tk.id_quadro = a.id_quadro and tk.id_tarefa_pai is null and coalesce(s.tipo, 'ativo') <> 'concluido'
       order by tk.created_at limit 2000
    loop
      v_ref := case when coalesce(a.condicao->'parada'->>'base', 'atualizacao') = 'status'
                    then coalesce((select max(h.created_at) from public.gestao_tarefa_historico h
                                    where h.id_tarefa = t.id_tarefa and h.tipo = 'status'), t.created_at)
                    else public.gestao_tarefa_ultima_atividade(t) end;
      if v_ref > now() - v_lim then continue; end if;
      v_chave := 'parada:' || to_char(v_ref, 'YYYY-MM-DD"T"HH24:MI:SS');
      if exists (select 1 from public.gestao_automacao_log l where l.id_automacao = a.id and l.id_tarefa = t.id_tarefa and l.chave = v_chave) then
        continue;
      end if;
      v_ctx := public.gestao_automacao_ctx(t, jsonb_build_object('vars', jsonb_build_object(
                 'dias_parada', floor(extract(epoch from (now() - v_ref)) / 86400)::int::text)));
      if ((a.condicao ? 'all') or (a.condicao ? 'any')) and not public.gestao_automacao_cond_bate(a.condicao, v_ctx) then continue; end if;
      perform public.gestao_automacao_executar(a, a.acoes, t, 'tarefa_parada', v_ctx, v_chave);
      v_paradas := v_paradas + 1;
    end loop;
  end loop;

  -- 4) data de início chegou (ou chega em N dias) — a partir das 7h
  if v_agora::time >= time '07:00' then
    for a in select * from public.gestao_automacoes where ativo and gatilho = 'data_inicio_chega' order by ordem loop
      for t in
        select tk.* from public.gestao_tarefas tk
          left join public.gestao_status s on s.id_quadro = tk.id_quadro and s.slug = tk.status
         where tk.id_quadro = a.id_quadro and tk.id_tarefa_pai is null and coalesce(s.tipo, 'ativo') <> 'concluido'
           and tk.data_inicio is not null
           and tk.data_inicio - coalesce(nullif(a.condicao->>'dias_antes', '')::int, 0) <= v_hoje
           and tk.data_inicio >= v_hoje - 1
      loop
        v_chave := 'inicio:' || t.data_inicio;
        if exists (select 1 from public.gestao_automacao_log l where l.id_automacao = a.id and l.id_tarefa = t.id_tarefa and l.chave = v_chave) then
          continue;
        end if;
        v_ctx := public.gestao_automacao_ctx(t, '{}'::jsonb);
        if ((a.condicao ? 'all') or (a.condicao ? 'any')) and not public.gestao_automacao_cond_bate(a.condicao, v_ctx) then continue; end if;
        perform public.gestao_automacao_executar(a, a.acoes, t, 'data_inicio_chega', v_ctx, v_chave);
        v_inicios := v_inicios + 1;
      end loop;
    end loop;
  end if;

  if v_agora::time >= time '07:00' then
    perform public.gestao_automacao_vencimentos();
  end if;

  perform set_config('gestao.autom_depth', v_depth::text, true);
  return jsonb_build_object('rodou', true, 'esperas', v_esperas, 'agendas', v_agenda, 'paradas', v_paradas, 'inicios', v_inicios);
exception when others then
  perform set_config('gestao.autom_depth', coalesce(v_depth, 0)::text, true);
  insert into public.gestao_automacao_log (gatilho, resultado, detalhe) values ('relogio', 'erro', left(SQLERRM, 300));
  return jsonb_build_object('rodou', false, 'erro', left(SQLERRM, 300));
end $function$;

CREATE OR REPLACE FUNCTION public.gestao_subtarefa_autom_trg()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  begin
    perform public.gestao_automacao_run(
      new.id_tarefa, 'subtarefa_concluida', null, null,
      jsonb_build_object(
        'subtarefa_id',    new.id,
        'subtarefa_texto', new.texto,
        'subtarefa_tipo',  new.tipo,
        'subtarefa_etapa', new.etapa
      )
    );
  exception when others then
    perform set_config('gestao.autom_depth', '0', true);
    insert into public.gestao_automacao_log (id_tarefa, gatilho, resultado, detalhe)
      values (new.id_tarefa, 'subtarefa_concluida', 'erro', left(SQLERRM, 300));
  end;
  return null;
end
$function$;

drop trigger if exists gestao_subtarefa_eventos_trg on public.gestao_subtarefas;
drop function if exists public.gestao_subtarefa_eventos_trg();
drop function if exists public.gestao_subtarefa_ctx(public.gestao_subtarefas, text);
notify pgrst, 'reload schema';
commit;
