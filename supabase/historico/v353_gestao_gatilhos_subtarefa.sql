-- v353 — Gestão: gatilhos de SUBTAREFA nas automações (12/11/2026, 0.3.284).
--
-- Trazida da v367 do Painel (0.3.949). O "Quando" das automações ganha o grupo Subtarefa: criada, concluída (já
-- existia), reaberta, etapa muda, renomeada, responsável adicionado/removido, entrega próxima/vencida e início chega.
-- Os corpos anteriores de gestao_automacao_prazos, gestao_automacao_relogio e gestao_subtarefa_autom_trg no JCN eram
-- iguais aos do Painel antes da v367 (conferido em 12/11). Sem regra ativa com esses gatilhos, nada muda.
--
-- REAPLICAR: não. ROLLBACK: scripts/sql/v353_gestao_gatilhos_subtarefa_rollback.sql
--
-- ─── texto original da v367 do Painel ───
-- v367 — Gestão: gatilhos de SUBTAREFA nas automações (11/11/2026).
--
-- Pedido do usuário (11/11): o "Quando" das automações ganha o grupo Subtarefa, com os equivalentes de Tarefa,
-- Pessoas e Datas. Lista aprovada:
--   Tarefa:  subtarefa_criada · subtarefa_concluida (já existia) · subtarefa_reaberta · subtarefa_etapa_muda ·
--            subtarefa_renomeada
--   Pessoas: subtarefa_responsavel_adicionado · subtarefa_responsavel_removido
--   Datas:   subtarefa_entrega_proxima (dias_antes, padrão 3) · subtarefa_entrega_vencida ·
--            subtarefa_inicio_chega (dias_antes, padrão 0)
--
-- COMO
--   gestao_subtarefa_ctx(sub, resp)   ctx da subtarefa: subtarefa_id/_texto/_tipo/_etapa/_responsavel e as variáveis
--                                     {subtarefa} {responsavel_subtarefa} {entrega_subtarefa} {inicio_subtarefa}.
--   gestao_subtarefa_eventos_trg      AFTER INSERT OR UPDATE OF feito, etapa, texto, responsavel_email — dispara os
--                                     gatilhos de evento pelo MESMO motor (gestao_automacao_run: profundidade ≤ 3,
--                                     ctx atualizado a cada regra), igual ao subtarefa_concluida. Só chama o motor se
--                                     o quadro do cartão tem regra ATIVA com aquele gatilho (sem regra = custo zero;
--                                     hoje nenhuma regra usa esses gatilhos, então aplicar não muda nada até alguém
--                                     criar uma).
--     - criada: toda subtarefa nova (tela, modelo de automação, formulário). Se já nasce com responsável, também
--       dispara responsavel_adicionado.
--     - reaberta: feito true → false.   etapa_muda: coluna etapa muda (ctx subtarefa_etapa_de = a anterior).
--     - renomeada: texto muda (variável {subtarefa_antes}).
--     - responsavel_removido roda com a pessoa ANTIGA no ctx; responsavel_adicionado com a nova (troca = os dois).
--     - Sincronização do Runrun / importador: mesma regra do subtarefa_concluida (este gatilho fica no mesmo caminho;
--       o que não dispara lá não dispara aqui).
--     - Laço: uma ação que cria subtarefa dispara subtarefa_criada, que pode criar outra… — o limite de
--       profundidade 3 do motor corta (registra 'skip profundidade' no histórico).
--   gestao_automacao_prazos (7h)      + entrega próxima (no máximo 1x por subtarefa por dia, na janela) e entrega
--                                     vencida (1x por subtarefa POR DATA DE ENTREGA: não repete todo dia; se a entrega
--                                     for adiada e vencer de novo, roda de novo). Cartão concluído e subtarefa feita
--                                     não entram. Deduplicação pela coluna chave do histórico, por subtarefa.
--   gestao_automacao_relogio (10 min) + início desejado da subtarefa (a partir das 7h, 1x por subtarefa e data).
--   gestao_subtarefa_autom_trg        subtarefa_concluida igual a antes, agora com o ctx/variáveis novos.
-- Regra completa/pausa (gestao_automacao_regra_completa): os gatilhos novos caem no caso geral (precisa de ações
-- completas) — nada a mudar. gatilho é text sem CHECK — nada a mudar.
--
-- REAPLICAR: as funções são create or replace; o bloco inicial recusa se a v367 já estiver registrada.
-- Rodar como chabra_admin com `psql -1 -v ON_ERROR_STOP=1`.
-- ROLLBACK: scripts/sql/v367_gestao_gatilhos_subtarefa.rollback.sql (definições de antes, copiadas da produção 11/11).

begin;

DO $$ BEGIN
  IF to_regprocedure('public.gestao_subtarefa_eventos_trg()') IS NOT NULL THEN
    RAISE EXCEPTION 'v353 já aplicada (gestao_subtarefa_eventos_trg existe)';
  END IF;
END $$;

-- ── ctx da subtarefa ──────────────────────────────────────────────────────────────
create or replace function public.gestao_subtarefa_ctx(p_sub public.gestao_subtarefas, p_resp text default null)
 returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  select jsonb_build_object(
    'subtarefa_id',          p_sub.id,
    'subtarefa_texto',       p_sub.texto,
    'subtarefa_tipo',        p_sub.tipo,
    'subtarefa_etapa',       p_sub.etapa,
    'subtarefa_responsavel', lower(coalesce(p_resp, p_sub.responsavel_email, '')),
    'vars', jsonb_build_object(
      'subtarefa',             coalesce(p_sub.texto, ''),
      'subtarefa_antes',       coalesce(p_sub.texto, ''),
      'responsavel_subtarefa', coalesce((select u.nome from public.usuarios u
                                          where lower(u.email) = lower(coalesce(p_resp, p_sub.responsavel_email)) limit 1),
                                        coalesce(p_resp, p_sub.responsavel_email, '')),
      'entrega_subtarefa',     coalesce(to_char(p_sub.entrega_desejada at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'), 'sem entrega'),
      'inicio_subtarefa',      coalesce(to_char(p_sub.inicio_desejado at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'), 'sem início')));
$function$;

-- ── eventos da subtarefa ──────────────────────────────────────────────────────────
create or replace function public.gestao_subtarefa_eventos_trg()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_gat text[] := '{}'; v_old_resp text; v_new_resp text; g text; v_ctx jsonb;
begin
  if tg_op = 'INSERT' then
    v_gat := array['subtarefa_criada'];
    if coalesce(btrim(new.responsavel_email), '') <> '' then v_gat := v_gat || 'subtarefa_responsavel_adicionado'::text; end if;
  else
    v_old_resp := lower(coalesce(btrim(old.responsavel_email), ''));
    v_new_resp := lower(coalesce(btrim(new.responsavel_email), ''));
    if old.feito is true and new.feito is not true then v_gat := v_gat || 'subtarefa_reaberta'::text; end if;
    if new.etapa is distinct from old.etapa then v_gat := v_gat || 'subtarefa_etapa_muda'::text; end if;
    if new.texto is distinct from old.texto then v_gat := v_gat || 'subtarefa_renomeada'::text; end if;
    if v_old_resp is distinct from v_new_resp then
      if v_old_resp <> '' then v_gat := v_gat || 'subtarefa_responsavel_removido'::text; end if;
      if v_new_resp <> '' then v_gat := v_gat || 'subtarefa_responsavel_adicionado'::text; end if;
    end if;
  end if;
  if cardinality(v_gat) = 0 then return null; end if;
  -- sem regra ativa com esses gatilhos no quadro do cartão: nada a fazer (não toca no motor)
  if not exists (select 1 from public.gestao_automacoes a join public.gestao_tarefas t on t.id_quadro = a.id_quadro
                  where t.id_tarefa = new.id_tarefa and a.ativo and a.gatilho = any (v_gat)) then
    return null;
  end if;
  foreach g in array v_gat loop
    begin
      v_ctx := public.gestao_subtarefa_ctx(new, case when g = 'subtarefa_responsavel_removido' then old.responsavel_email end);
      if tg_op = 'UPDATE' then
        v_ctx := v_ctx || jsonb_build_object('subtarefa_etapa_de', old.etapa)
                       || jsonb_build_object('vars', (v_ctx->'vars') || jsonb_build_object('subtarefa_antes', coalesce(old.texto, '')));
      end if;
      perform public.gestao_automacao_run(new.id_tarefa, g, null, null, v_ctx);
    exception when others then
      perform set_config('gestao.autom_depth', '0', true);
      insert into public.gestao_automacao_log (id_tarefa, gatilho, resultado, detalhe)
        values (new.id_tarefa, g, 'erro', left(SQLERRM, 300));
    end;
  end loop;
  return null;
end $function$;

drop trigger if exists gestao_subtarefa_eventos_trg on public.gestao_subtarefas;
create trigger gestao_subtarefa_eventos_trg
  after insert or update of feito, etapa, texto, responsavel_email on public.gestao_subtarefas
  for each row execute function public.gestao_subtarefa_eventos_trg();

-- ── prazos (7h): + entrega da subtarefa ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.gestao_automacao_prazos()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.gestao_automacoes; t public.gestao_tarefas; v_dias int; v_depth int; v_ctx jsonb;
  s public.gestao_subtarefas; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date; v_ent date; v_chave text;
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
  -- v367: entrega desejada da SUBTAREFA. Próxima: no máximo 1x por subtarefa por dia, enquanto estiver na janela.
  -- Vencida: 1x por subtarefa para cada data de entrega (se a entrega mudar e vencer de novo, roda de novo).
  for a in select * from public.gestao_automacoes where ativo and gatilho in ('subtarefa_entrega_proxima','subtarefa_entrega_vencida') order by ordem loop
    v_dias := coalesce(nullif(a.condicao->>'dias_antes', '')::int, 3);
    for s in
      select sb.* from public.gestao_subtarefas sb
        join public.gestao_tarefas tk on tk.id_tarefa = sb.id_tarefa
        left join public.gestao_status st on st.id_quadro = tk.id_quadro and st.slug = tk.status
       where tk.id_quadro = a.id_quadro and tk.id_tarefa_pai is null and coalesce(st.tipo, 'ativo') <> 'concluido'
         and not sb.feito and sb.entrega_desejada is not null
         and ((a.gatilho = 'subtarefa_entrega_proxima'
               and v_hoje >= ((sb.entrega_desejada at time zone 'America/Sao_Paulo')::date - v_dias)
               and v_hoje <= (sb.entrega_desejada at time zone 'America/Sao_Paulo')::date)
              or (a.gatilho = 'subtarefa_entrega_vencida' and sb.entrega_desejada < now()))
    loop
      v_ent := (s.entrega_desejada at time zone 'America/Sao_Paulo')::date;
      v_chave := case when a.gatilho = 'subtarefa_entrega_proxima' then 'sub-prox:' || s.id || ':' || v_hoje
                      else 'sub-venc:' || s.id || ':' || v_ent end;
      if exists (select 1 from public.gestao_automacao_log l
                  where l.id_automacao = a.id and l.id_tarefa = s.id_tarefa and l.chave = v_chave) then
        continue;
      end if;
      select * into t from public.gestao_tarefas where id_tarefa = s.id_tarefa;
      v_ctx := public.gestao_automacao_ctx(t, public.gestao_subtarefa_ctx(s, null));
      if ((a.condicao ? 'all') or (a.condicao ? 'any')) and not public.gestao_automacao_cond_bate(a.condicao, v_ctx) then
        continue;
      end if;
      perform public.gestao_automacao_executar(a,
        case when jsonb_array_length(coalesce(a.acoes, '[]'::jsonb)) > 0 then a.acoes
             when coalesce(a.acao->>'tipo', '') <> '' then jsonb_build_array(a.acao) else '[]'::jsonb end,
        t, a.gatilho, v_ctx, v_chave);
    end loop;
  end loop;

  perform set_config('gestao.autom_depth', v_depth::text, true);
exception when others then
  perform set_config('gestao.autom_depth', coalesce(v_depth, 0)::text, true);
end $function$;

-- ── relógio (10 min): + início da subtarefa ──────────────────────────────────────
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
  s public.gestao_subtarefas; v_ini date; v_inicios_sub int := 0;
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

  -- 4b) v367: início desejado da SUBTAREFA chegou (ou chega em N dias) — a partir das 7h, 1x por subtarefa e data
  if v_agora::time >= time '07:00' then
    for a in select * from public.gestao_automacoes where ativo and gatilho = 'subtarefa_inicio_chega' order by ordem loop
      for s in
        select sb.* from public.gestao_subtarefas sb
          join public.gestao_tarefas tk on tk.id_tarefa = sb.id_tarefa
          left join public.gestao_status st on st.id_quadro = tk.id_quadro and st.slug = tk.status
         where tk.id_quadro = a.id_quadro and tk.id_tarefa_pai is null and coalesce(st.tipo, 'ativo') <> 'concluido'
           and not sb.feito and sb.inicio_desejado is not null
           and (sb.inicio_desejado at time zone 'America/Sao_Paulo')::date - coalesce(nullif(a.condicao->>'dias_antes', '')::int, 0) <= v_hoje
           and (sb.inicio_desejado at time zone 'America/Sao_Paulo')::date >= v_hoje - 1
      loop
        v_ini := (s.inicio_desejado at time zone 'America/Sao_Paulo')::date;
        v_chave := 'sub-inicio:' || s.id || ':' || v_ini;
        if exists (select 1 from public.gestao_automacao_log l where l.id_automacao = a.id and l.id_tarefa = s.id_tarefa and l.chave = v_chave) then
          continue;
        end if;
        select * into t from public.gestao_tarefas where id_tarefa = s.id_tarefa;
        v_ctx := public.gestao_automacao_ctx(t, public.gestao_subtarefa_ctx(s, null));
        if ((a.condicao ? 'all') or (a.condicao ? 'any')) and not public.gestao_automacao_cond_bate(a.condicao, v_ctx) then continue; end if;
        perform public.gestao_automacao_executar(a, a.acoes, t, 'subtarefa_inicio_chega', v_ctx, v_chave);
        v_inicios_sub := v_inicios_sub + 1;
      end loop;
    end loop;
  end if;

  if v_agora::time >= time '07:00' then
    perform public.gestao_automacao_vencimentos();
  end if;

  perform set_config('gestao.autom_depth', v_depth::text, true);
  return jsonb_build_object('rodou', true, 'esperas', v_esperas, 'agendas', v_agenda, 'paradas', v_paradas, 'inicios', v_inicios, 'inicios_subtarefa', v_inicios_sub);
exception when others then
  perform set_config('gestao.autom_depth', coalesce(v_depth, 0)::text, true);
  insert into public.gestao_automacao_log (gatilho, resultado, detalhe) values ('relogio', 'erro', left(SQLERRM, 300));
  return jsonb_build_object('rodou', false, 'erro', left(SQLERRM, 300));
end $function$;

-- ── subtarefa concluída: mesmas regras, ctx novo ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.gestao_subtarefa_autom_trg()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  begin
    -- v367: mesmo disparo de antes; o ctx ganha responsável/entrega e as variáveis {subtarefa} etc.
    perform public.gestao_automacao_run(new.id_tarefa, 'subtarefa_concluida', null, null, public.gestao_subtarefa_ctx(new, null));
  exception when others then
    perform set_config('gestao.autom_depth', '0', true);
    insert into public.gestao_automacao_log (id_tarefa, gatilho, resultado, detalhe)
      values (new.id_tarefa, 'subtarefa_concluida', 'erro', left(SQLERRM, 300));
  end;
  return null;
end
$function$;

grant execute on function public.gestao_subtarefa_ctx(public.gestao_subtarefas, text) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
