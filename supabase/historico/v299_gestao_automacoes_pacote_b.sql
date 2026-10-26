-- v299 (JCN) — Gestão: automações, Pacote B — tempo e cobrança (levantamento de 26/10/2026).
--
-- O QUE MUDA
--   gestao_automacao_relogio()          o "relógio" das automações, a cada 10 min (pg_cron no JCN; no
--                                       painel, o worker /api/gestao/google/sync também chama):
--                                         1) esperas vencidas  — continua as ações depois de "aguardar";
--                                         2) agenda            — regra "agendado": todo dia / dias úteis /
--                                            dias da semana / dia X do mês, a partir de HH:MM; age em cada
--                                            tarefa do quadro que casar a condição OU cria uma tarefa a
--                                            partir de um modelo (título com variáveis, prazo relativo,
--                                            responsáveis, etiquetas);
--                                         3) tarefa parada / SLA — N horas/dias sem atualização ou no mesmo
--                                            status; uma vez por "entrada" (se mexerem e parar de novo,
--                                            cobra de novo);
--                                         4) data de início chegou (ou chega em N dias).
--   gatilho dependencia_liberada        quando a ÚLTIMA bloqueadora de uma tarefa é concluída.
--   ação aguardar                       {quantidade, unidade: horas|dias} — o resto da lista roda depois
--                                       (a condição "só se…" de cada ação é avaliada na hora em que roda:
--                                       "aguardar 2 dias → se ainda não concluída, avisar").
--   gestao_automacao_esperas            fila das esperas.
--   gestao_automacao_log.chave          evita repetir a mesma execução (dia da agenda, entrada no status…).
--   gestao_automacao_regra_completa()   a regra está completa? (agora depende do gatilho também)
--
-- REAPLICAR: idempotente. ROLLBACK: scripts/sql/v299_gestao_automacoes_pacote_b_rollback.sql

-- ── 1) Estrutura ────────────────────────────────────────────────────────────
alter table public.gestao_automacao_log add column if not exists chave text;
create index if not exists gestao_automacao_log_chave_idx
  on public.gestao_automacao_log (id_automacao, id_tarefa, chave) where chave is not null;

create table if not exists public.gestao_automacao_esperas (
  id            uuid primary key default gen_random_uuid(),
  id_automacao  uuid not null references public.gestao_automacoes(id) on delete cascade,
  id_tarefa     text not null references public.gestao_tarefas(id_tarefa) on delete cascade,
  gatilho       text not null,
  acoes         jsonb not null,
  ctx           jsonb not null default '{}'::jsonb,
  executar_em   timestamptz not null,
  criado_em     timestamptz not null default now(),
  executado_em  timestamptz
);
create index if not exists gestao_automacao_esperas_pend_idx
  on public.gestao_automacao_esperas (executar_em) where executado_em is null;
alter table public.gestao_automacao_esperas enable row level security;
drop policy if exists gestao_autom_esperas_sel on public.gestao_automacao_esperas;
create policy gestao_autom_esperas_sel on public.gestao_automacao_esperas for select to authenticated
  using (exists (select 1 from public.gestao_automacoes a where a.id = gestao_automacao_esperas.id_automacao and public.gestao_pode_ver(a.id_quadro)));
revoke insert, update, delete on public.gestao_automacao_esperas from anon, authenticated;
grant select on public.gestao_automacao_esperas to authenticated;

-- ── 2) Completude ───────────────────────────────────────────────────────────
create or replace function public.gestao_automacao_completa(p_acao jsonb) returns boolean
  language sql immutable as $$
  select case coalesce(p_acao->>'tipo', '')
    when 'mover_status'             then coalesce(p_acao->>'valor', '') <> ''
    when 'mover_status_se_completo' then coalesce(p_acao->>'valor', '') <> ''
    when 'definir_responsavel'      then coalesce(p_acao->>'valor', '') <> ''
    when 'definir_prioridade'       then coalesce(p_acao->>'valor', '') <> ''
    when 'definir_campo'            then coalesce(p_acao->>'campo_id', '') <> ''
    when 'adicionar_vinculados'     then jsonb_typeof(p_acao->'emails') = 'array' and jsonb_array_length(p_acao->'emails') > 0
    when 'mover_tarefa_quadro'      then coalesce(p_acao->>'id_quadro_destino', '') <> ''
    when 'criar_tarefa_quadro'      then coalesce(p_acao->>'id_quadro_destino', '') <> ''
    when 'criar_subtarefas_modelo'  then coalesce(p_acao->>'modelo_slug', '') <> ''
    when 'notificar'                then true
    when 'solicitar_aprovacao'      then true
    when 'comentar'                 then coalesce(btrim(p_acao->>'texto'), '') <> ''
    when 'enviar_email'             then coalesce(btrim(p_acao->>'assunto'), '') <> ''
                                         and (coalesce(p_acao->>'para', '') in ('vinculados', 'responsaveis')
                                              or (jsonb_typeof(p_acao->'emails') = 'array' and jsonb_array_length(p_acao->'emails') > 0))
    when 'definir_prazo'            then coalesce(p_acao->>'dias', '') ~ '^-?[0-9]+$'
    when 'adicionar_etiqueta'       then coalesce(btrim(p_acao->>'valor'), '') <> ''
    when 'remover_etiqueta'         then coalesce(btrim(p_acao->>'valor'), '') <> ''
    when 'concluir'                 then true
    when 'duplicar_tarefa'          then true
    -- v299
    when 'aguardar'                 then coalesce(p_acao->>'quantidade', '') ~ '^[0-9]+$' and (p_acao->>'quantidade')::int > 0
                                         and coalesce(p_acao->>'unidade', 'dias') in ('horas', 'dias')
    else false
  end;
$$;

-- a agenda está bem preenchida?
create or replace function public.gestao_agenda_valida(p jsonb) returns boolean
  language sql immutable as $$
  select coalesce(p is not null
     and coalesce(p->>'hora', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     and case coalesce(p->>'freq', '')
           when 'diaria' then true
           when 'dias_uteis' then true
           when 'semanal' then coalesce(jsonb_typeof(p->'dias_semana') = 'array' and jsonb_array_length(p->'dias_semana') > 0, false)
           when 'mensal' then coalesce(p->>'dia_mes', '') ~ '^([1-9]|[12][0-9]|3[01]|ultimo)$'
           else false end, false);
$$;

-- o modelo de tarefa (para "criar tarefa") tem título?
create or replace function public.gestao_modelo_tarefa_valido(p jsonb) returns boolean
  language sql immutable as $$
  select p is not null and coalesce(btrim(p->>'titulo'), '') <> ''
     and (coalesce(p->>'prazo_dias', '') = '' or (p->>'prazo_dias') ~ '^-?[0-9]+$');
$$;

create or replace function public.gestao_automacao_regra_completa(p_gatilho text, p_condicao jsonb, p_acoes jsonb) returns boolean
  language sql immutable as $$
  select coalesce(case
    when p_gatilho = 'agendado' then
      public.gestao_agenda_valida(p_condicao->'agenda')
      and case when coalesce(p_condicao->>'modo', 'cada_tarefa') = 'criar_tarefa'
               then public.gestao_modelo_tarefa_valido(p_condicao->'modelo_tarefa')
                    and (jsonb_array_length(coalesce(p_acoes, '[]'::jsonb)) = 0 or public.gestao_automacao_completa_lista(p_acoes))
               else public.gestao_automacao_completa_lista(p_acoes) end
    when p_gatilho = 'tarefa_parada' then
      coalesce(p_condicao->'parada'->>'quantidade', '') ~ '^[0-9]+$' and (p_condicao->'parada'->>'quantidade')::int > 0
      and public.gestao_automacao_completa_lista(p_acoes)
    else public.gestao_automacao_completa_lista(p_acoes)
  end, false);
$$;

create or replace function public.gestao_automacao_completa_trg() returns trigger
  language plpgsql as $$
begin
  if (new.acoes is null or jsonb_array_length(new.acoes) = 0) and coalesce(new.acao->>'tipo', '') <> '' then
    new.acoes := jsonb_build_array(new.acao);
  end if;
  new.acoes := coalesce(new.acoes, '[]'::jsonb);
  new.acao := coalesce(new.acoes->0, '{}'::jsonb);
  if new.ativo and not public.gestao_automacao_regra_completa(new.gatilho, coalesce(new.condicao, '{}'::jsonb), new.acoes) then
    new.ativo := false;
  end if;
  return new;
end $$;

-- ── 3) Executar uma lista de ações (com "aguardar") ─────────────────────────
create or replace function public.gestao_automacao_executar(p_autom public.gestao_automacoes, p_acoes jsonb,
    p_tarefa public.gestao_tarefas, p_gatilho text, p_ctx jsonb, p_chave text default null, p_nota text default null)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_acao jsonb; v_r jsonb; v_i int := 0; v_n int := jsonb_array_length(coalesce(p_acoes, '[]'::jsonb));
  v_tarefa public.gestao_tarefas := p_tarefa;
  v_ctx jsonb := coalesce(p_ctx, '{}'::jsonb);
  v_partes text[] := case when p_nota is null then '{}'::text[] else array[p_nota] end;
  v_ok boolean := false; v_erro boolean := false; v_quando timestamptz; v_resto jsonb;
begin
  for v_acao in select value from jsonb_array_elements(coalesce(p_acoes, '[]'::jsonb)) loop
    v_i := v_i + 1;
    if v_acao->>'tipo' = 'aguardar' then
      v_quando := now() + case when v_acao->>'unidade' = 'horas'
                               then make_interval(hours => coalesce(nullif(v_acao->>'quantidade', '')::int, 1))
                               else make_interval(days => coalesce(nullif(v_acao->>'quantidade', '')::int, 1)) end;
      select coalesce(jsonb_agg(value order by ord), '[]'::jsonb) into v_resto
        from jsonb_array_elements(p_acoes) with ordinality as e(value, ord) where ord > v_i;
      if jsonb_array_length(v_resto) = 0 then
        v_partes := v_partes || (v_i || '. aguardar: nada depois');
      else
        insert into public.gestao_automacao_esperas (id_automacao, id_tarefa, gatilho, acoes, ctx, executar_em)
        values (p_autom.id, v_tarefa.id_tarefa, p_gatilho, v_resto, v_ctx - 'campos' - 'etiquetas', v_quando);
        v_partes := v_partes || (v_i || '. aguardar: o resto roda em '
                                 || to_char(v_quando at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'));
        v_ok := true;
      end if;
      exit;
    end if;
    if (v_acao->'condicao') is not null and ((v_acao->'condicao') ? 'all' or (v_acao->'condicao') ? 'any')
       and not public.gestao_automacao_cond_bate(v_acao->'condicao', v_ctx) then
      v_partes := v_partes || (v_i || '. ' || coalesce(v_acao->>'tipo', '?') || ': condição da ação não casou');
      continue;
    end if;
    v_r := public.gestao_automacao_acao(p_autom, v_acao, v_tarefa, p_gatilho, v_ctx);
    v_partes := v_partes || (v_i || '. ' || coalesce(v_acao->>'tipo', '?') || ': ' || (v_r->>'res')
                              || coalesce(' — ' || (v_r->>'det'), ''));
    if v_r->>'res' = 'ok' then v_ok := true; elsif v_r->>'res' = 'erro' then v_erro := true; end if;
    select * into v_tarefa from public.gestao_tarefas where id_tarefa = p_tarefa.id_tarefa;
    if not found then exit; end if;
    v_ctx := public.gestao_automacao_ctx(v_tarefa, v_ctx);
  end loop;

  insert into public.gestao_automacao_log (id_automacao, id_tarefa, gatilho, resultado, detalhe, profundidade, chave)
  values (p_autom.id, p_tarefa.id_tarefa, p_gatilho,
          case when v_erro then 'erro' when v_ok then 'ok' when v_n = 0 then 'ok' else 'skip' end,
          left(coalesce(nullif(array_to_string(v_partes, ' · '), ''), 'sem ações'), 1000),
          coalesce(nullif(current_setting('gestao.autom_depth', true), ''), '0')::int, p_chave);
end $$;

create or replace function public.gestao_automacao_aplicar(p_autom public.gestao_automacoes, p_tarefa public.gestao_tarefas,
                                                           p_gatilho text, p_ctx jsonb)
  returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.gestao_automacao_executar(
    p_autom,
    case when jsonb_array_length(coalesce(p_autom.acoes, '[]'::jsonb)) > 0 then p_autom.acoes
         when coalesce(p_autom.acao->>'tipo', '') <> '' then jsonb_build_array(p_autom.acao)
         else '[]'::jsonb end,
    p_tarefa, p_gatilho, p_ctx);
end $$;

-- ── 4) Criar tarefa a partir de um modelo (agenda; também os gatilhos do SST, v300) ──
-- modelo: {titulo, descricao, prioridade, prazo_dias, prazo_uteis, etiquetas[], responsaveis[] (e-mails)}
create or replace function public.gestao_automacao_criar_tarefa(p_autom public.gestao_automacoes, p_modelo jsonb, p_ctx jsonb)
  returns public.gestao_tarefas language plpgsql security definer set search_path = public as $$
declare
  v_vazia public.gestao_tarefas; v_t public.gestao_tarefas; v_id text; v_status text; v_prazo date; v_e text;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select slug into v_status from public.gestao_status where id_quadro = p_autom.id_quadro
   order by (tipo = 'nao_iniciado') desc, ordem limit 1;
  if coalesce(p_modelo->>'prazo_dias', '') ~ '^-?[0-9]+$' then
    v_prazo := public.gestao_somar_dias(v_hoje, (p_modelo->>'prazo_dias')::int, coalesce(p_modelo->>'prazo_uteis', '') in ('true', '1'));
  end if;
  v_id := 'TRF-' || upper(substring(replace(gen_random_uuid()::text,'-','') from 1 for 8));
  insert into public.gestao_tarefas (id_tarefa, id_quadro, titulo, descricao, status, prioridade, prazo, etiquetas, campos,
                                     created_by, origem, ordem)
  values (v_id, p_autom.id_quadro,
          left(coalesce(nullif(btrim(public.gestao_automacao_texto(p_modelo->>'titulo', v_vazia, p_ctx)), ''), p_autom.nome), 300),
          nullif(btrim(public.gestao_automacao_texto(p_modelo->>'descricao', v_vazia, p_ctx)), ''),
          coalesce(v_status, 'A_FAZER'),
          coalesce(nullif(p_modelo->>'prioridade', ''), 'Media'),
          v_prazo,
          coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_modelo->'etiquetas', '[]'::jsonb)) x), '{}'::text[]),
          '{}'::jsonb, 'automacao',
          jsonb_build_object('tipo', 'automacao', 'id_automacao', p_autom.id) || coalesce(p_ctx->'origem_extra', '{}'::jsonb),
          0);
  for v_e in select lower(btrim(x)) from jsonb_array_elements_text(coalesce(p_modelo->'responsaveis', '[]'::jsonb)) x loop
    if v_e like '%@%' then
      insert into public.gestao_tarefa_vinculados (id, id_tarefa, usuario_email, tipo, origem)
      values (gen_random_uuid(), v_id, v_e, 'responsavel', 'automacao')
      on conflict (id_tarefa, usuario_email, tipo) do nothing;
    end if;
  end loop;
  select * into v_t from public.gestao_tarefas where id_tarefa = v_id;
  return v_t;
end $$;

-- ── 5) Agenda: está na hora? ────────────────────────────────────────────────
create or replace function public.gestao_agenda_devida(p jsonb, p_agora timestamp) returns boolean
  language plpgsql immutable as $$
declare v_dia date := p_agora::date; v_ult int := extract(day from (date_trunc('month', p_agora) + interval '1 month - 1 day'))::int;
begin
  if not public.gestao_agenda_valida(p) then return false; end if;
  if p_agora::time < (p->>'hora')::time then return false; end if;
  return case p->>'freq'
    when 'diaria' then true
    when 'dias_uteis' then extract(isodow from v_dia) < 6
    when 'semanal' then exists (select 1 from jsonb_array_elements_text(p->'dias_semana') d where d::int = extract(isodow from v_dia)::int)
    when 'mensal' then case when p->>'dia_mes' = 'ultimo' then extract(day from v_dia)::int = v_ult
                            else extract(day from v_dia)::int = least((p->>'dia_mes')::int, v_ult) end
    else false end;
end $$;

-- Última atividade: a maior entre atualização, histórico e comentário de PESSOA (o da automação não
-- conta — senão a própria cobrança "zera" a contagem). Mudar o status não mexe em updated_at.
create or replace function public.gestao_tarefa_ultima_atividade(p_tarefa public.gestao_tarefas) returns timestamptz
  language sql stable security definer set search_path = public as $$
  select greatest(
    coalesce(p_tarefa.updated_at, p_tarefa.created_at),
    p_tarefa.created_at,
    (select max(h.created_at) from public.gestao_tarefa_historico h where h.id_tarefa = p_tarefa.id_tarefa),
    (select max(c.created_at) from public.gestao_comentarios c where c.id_tarefa = p_tarefa.id_tarefa and c.autor <> 'automacao')
  );
$$;
revoke all on function public.gestao_tarefa_ultima_atividade(public.gestao_tarefas) from public, anon, authenticated;

-- ── 6) O relógio ────────────────────────────────────────────────────────────
create or replace function public.gestao_automacao_relogio() returns jsonb
  language plpgsql security definer set search_path = public as $$
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

  perform set_config('gestao.autom_depth', v_depth::text, true);
  return jsonb_build_object('rodou', true, 'esperas', v_esperas, 'agendas', v_agenda, 'paradas', v_paradas, 'inicios', v_inicios);
exception when others then
  perform set_config('gestao.autom_depth', coalesce(v_depth, 0)::text, true);
  insert into public.gestao_automacao_log (gatilho, resultado, detalhe) values ('relogio', 'erro', left(SQLERRM, 300));
  return jsonb_build_object('rodou', false, 'erro', left(SQLERRM, 300));
end $$;

-- ── 7) Dependência liberada (no gatilho de status) ──────────────────────────
create or replace function public.gestao_automacao_trg() returns trigger
  language plpgsql security definer set search_path = public as $$
declare k text; e text; d text; v_tipo_novo text; v_tipo_velho text;
begin
  if new.id_tarefa_pai is not null then return null; end if;
  begin
    if tg_op = 'INSERT' then
      perform public.gestao_automacao_run(new.id_tarefa, 'tarefa_criada', null, null);
    elsif tg_op = 'UPDATE' then
      if old.id_quadro is distinct from new.id_quadro then
        perform public.gestao_automacao_run(new.id_tarefa, 'tarefa_movida_quadro', old.id_quadro, new.id_quadro);
      end if;
      if old.status is distinct from new.status then
        perform public.gestao_automacao_run(new.id_tarefa, 'status_muda', old.status, new.status);
        -- v299: a última bloqueadora concluída libera a dependente
        select tipo into v_tipo_novo from public.gestao_status where id_quadro = new.id_quadro and slug = new.status;
        select tipo into v_tipo_velho from public.gestao_status where id_quadro = old.id_quadro and slug = old.status;
        if coalesce(v_tipo_novo, '') = 'concluido' and coalesce(v_tipo_velho, '') <> 'concluido' then
          for d in
            select distinct dp.id_tarefa from public.gestao_dependencias dp where dp.depende_de = new.id_tarefa
          loop
            if not exists (
              select 1 from public.gestao_dependencias x
                join public.gestao_tarefas b on b.id_tarefa = x.depende_de
                left join public.gestao_status s on s.id_quadro = b.id_quadro and s.slug = b.status
               where x.id_tarefa = d and coalesce(s.tipo, 'ativo') <> 'concluido'
            ) then
              perform public.gestao_automacao_run(d, 'dependencia_liberada', null, null,
                jsonb_build_object('vars', jsonb_build_object('bloqueadora', new.titulo)));
            end if;
          end loop;
        end if;
      end if;
      if old.prioridade is distinct from new.prioridade then
        perform public.gestao_automacao_run(new.id_tarefa, 'prioridade_muda', null, null,
          jsonb_build_object('prioridade_de', old.prioridade));
      end if;
      if old.campos is distinct from new.campos then
        for k in
          select key from jsonb_each(coalesce(new.campos, '{}'::jsonb))
           where (coalesce(old.campos, '{}'::jsonb) -> key) is distinct from value
          union
          select key from jsonb_each(coalesce(old.campos, '{}'::jsonb)) where not (coalesce(new.campos, '{}'::jsonb) ? key)
        loop
          perform public.gestao_automacao_run(new.id_tarefa, 'campo_muda', null, null, jsonb_build_object('campo_alterado', k));
        end loop;
      end if;
      if old.etiquetas is distinct from new.etiquetas then
        for e in select x from unnest(coalesce(new.etiquetas, '{}'::text[])) x where not (x = any (coalesce(old.etiquetas, '{}'::text[]))) loop
          perform public.gestao_automacao_run(new.id_tarefa, 'etiqueta_adicionada', null, null,
            jsonb_build_object('etiqueta_nova', e, 'vars', jsonb_build_object('etiqueta', e)));
        end loop;
      end if;
    end if;
  exception when others then
    perform set_config('gestao.autom_depth', '0', true);
    insert into public.gestao_automacao_log (id_tarefa, gatilho, resultado, detalhe)
    values (new.id_tarefa, tg_op, 'erro', left(SQLERRM, 300));
  end;
  return null;
end $$;

-- ── 8) Agendamento (JCN: pg_cron a cada 10 min) ─────────────────────────────
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'gestao-automacao-relogio') then
      perform cron.unschedule('gestao-automacao-relogio');
    end if;
    perform cron.schedule('gestao-automacao-relogio', '*/10 * * * *', 'select public.gestao_automacao_relogio()');
  end if;
end $$;

-- ── 9) Permissões ───────────────────────────────────────────────────────────
revoke all on function public.gestao_automacao_executar(public.gestao_automacoes, jsonb, public.gestao_tarefas, text, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.gestao_automacao_criar_tarefa(public.gestao_automacoes, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.gestao_automacao_relogio() from public, anon, authenticated;
grant execute on function public.gestao_automacao_relogio() to service_role;

notify pgrst, 'reload schema';
