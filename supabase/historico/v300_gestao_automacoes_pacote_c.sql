-- v300 (JCN) — Gestão: automações, Pacote C — produtividade (levantamento de 26/10/2026).
--
-- O QUE MUDA
--   ação atribuir_rodizio            {emails[], modo: rodizio|menor_carga, substituir: 'true'|''}
--                                    rodízio: o próximo da lista depois do último que recebeu (por regra);
--                                    menor carga: quem tem menos tarefas ABERTAS como responsável (todos os
--                                    quadros; empate = ordem da lista). substituir = tira os outros
--                                    responsáveis antes.
--   gestao_automacao_estado          memória das regras (quem recebeu por último no rodízio).
--   gatilho manual                   a regra só roda quando alguém clica (botão na tarefa e nas ações em
--                                    massa) — gestao_automacao_executar_manual(id, tarefas[]).
--   (as receitas prontas ficam no código: lib/gestao/receitas-automacao.ts)
--
-- REAPLICAR: idempotente. ROLLBACK: scripts/sql/v300_gestao_automacoes_pacote_c_rollback.sql

create table if not exists public.gestao_automacao_estado (
  id_automacao  uuid not null references public.gestao_automacoes(id) on delete cascade,
  chave         text not null,
  valor         text,
  atualizado_em timestamptz not null default now(),
  primary key (id_automacao, chave)
);
alter table public.gestao_automacao_estado enable row level security;
revoke all on public.gestao_automacao_estado from anon, authenticated;

-- ── Completude: ação nova ───────────────────────────────────────────────────
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
    when 'aguardar'                 then coalesce(p_acao->>'quantidade', '') ~ '^[0-9]+$' and (p_acao->>'quantidade')::int > 0
                                         and coalesce(p_acao->>'unidade', 'dias') in ('horas', 'dias')
    -- v300
    when 'atribuir_rodizio'         then jsonb_typeof(p_acao->'emails') = 'array' and jsonb_array_length(p_acao->'emails') > 0
                                         and coalesce(p_acao->>'modo', 'rodizio') in ('rodizio', 'menor_carga')
    else false
  end;
$$;

-- ── Escolher a pessoa ───────────────────────────────────────────────────────
create or replace function public.gestao_automacao_escolher(p_autom_id uuid, p_acao jsonb) returns text
  language plpgsql security definer set search_path = public as $$
declare
  v_lista text[]; v_chave text := 'rodizio:' || coalesce(nullif(p_acao->>'id', ''), 'padrao'); v_ultimo text; v_pos int; v_escolhido text;
begin
  select array_agg(lower(btrim(x)) order by ord) into v_lista
    from jsonb_array_elements_text(coalesce(p_acao->'emails', '[]'::jsonb)) with ordinality as e(x, ord)
   where btrim(x) like '%@%';
  if v_lista is null or array_length(v_lista, 1) is null then return null; end if;

  if coalesce(p_acao->>'modo', 'rodizio') = 'menor_carga' then
    select l.email into v_escolhido
      from unnest(v_lista) with ordinality as l(email, ord)
      left join lateral (
        select count(*) as abertas
          from public.gestao_tarefa_vinculados v
          join public.gestao_tarefas t on t.id_tarefa = v.id_tarefa
          left join public.gestao_status s on s.id_quadro = t.id_quadro and s.slug = t.status
         where lower(v.usuario_email) = l.email and v.tipo = 'responsavel'
           and t.id_tarefa_pai is null and coalesce(s.tipo, 'ativo') <> 'concluido'
      ) c on true
     order by c.abertas, l.ord limit 1;
  else
    select valor into v_ultimo from public.gestao_automacao_estado where id_automacao = p_autom_id and chave = v_chave;
    v_pos := array_position(v_lista, v_ultimo);
    v_escolhido := v_lista[case when v_pos is null or v_pos >= array_length(v_lista, 1) then 1 else v_pos + 1 end];
    insert into public.gestao_automacao_estado (id_automacao, chave, valor, atualizado_em)
    values (p_autom_id, v_chave, v_escolhido, now())
    on conflict (id_automacao, chave) do update set valor = excluded.valor, atualizado_em = now();
  end if;
  return v_escolhido;
end $$;

-- ── A ação atribuir_rodizio (função própria; o executar despacha para ela) ──
create or replace function public.gestao_automacao_acao_rodizio(p_autom public.gestao_automacoes, p_acao jsonb,
                                                                p_tarefa public.gestao_tarefas)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare v_email text; v_nome text; v_removidos int := 0;
begin
  v_email := public.gestao_automacao_escolher(p_autom.id, p_acao);
  if v_email is null then
    return jsonb_build_object('res', 'skip', 'det', 'lista de pessoas vazia');
  end if;
  if coalesce(p_acao->>'substituir', '') in ('true', '1') then
    delete from public.gestao_tarefa_vinculados
     where id_tarefa = p_tarefa.id_tarefa and tipo = 'responsavel' and lower(usuario_email) <> v_email;
    get diagnostics v_removidos = row_count;
  end if;
  insert into public.gestao_tarefa_vinculados (id, id_tarefa, usuario_email, tipo, origem)
  values (gen_random_uuid(), p_tarefa.id_tarefa, v_email, 'responsavel', 'automacao')
  on conflict (id_tarefa, usuario_email, tipo) do nothing;
  select nome into v_nome from public.usuarios where lower(email) = v_email limit 1;
  return jsonb_build_object('res', 'ok', 'det',
    (case when coalesce(p_acao->>'modo', 'rodizio') = 'menor_carga' then 'menor carga → ' else 'rodízio → ' end)
    || coalesce(v_nome, v_email) || case when v_removidos > 0 then ' (substituiu ' || v_removidos || ')' else '' end);
exception when others then
  return jsonb_build_object('res', 'erro', 'det', left(SQLERRM, 300));
end $$;

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
    v_r := case when v_acao->>'tipo' = 'atribuir_rodizio'
                then public.gestao_automacao_acao_rodizio(p_autom, v_acao, v_tarefa)
                else public.gestao_automacao_acao(p_autom, v_acao, v_tarefa, p_gatilho, v_ctx) end;
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

-- ── Botão manual ────────────────────────────────────────────────────────────
create or replace function public.gestao_automacao_executar_manual(p_id_automacao uuid, p_ids text[])
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a public.gestao_automacoes; t public.gestao_tarefas; v_id text; v_ok int := 0; v_ign int := 0; v_depth int;
  v_email text := public.gestao_email(); v_nome text;
begin
  select * into a from public.gestao_automacoes where id = p_id_automacao;
  if not found or a.gatilho <> 'manual' then
    raise exception 'Automação não encontrada.' using errcode = 'P0001';
  end if;
  if not a.ativo then
    raise exception 'Automação desligada ou incompleta.' using errcode = 'P0001';
  end if;
  if coalesce(array_length(p_ids, 1), 0) > 200 then
    raise exception 'No máximo 200 tarefas por vez.' using errcode = 'P0001';
  end if;
  select nome into v_nome from public.usuarios where lower(email) = lower(coalesce(v_email, '')) limit 1;
  v_depth := coalesce(nullif(current_setting('gestao.autom_depth', true), ''), '0')::int;
  perform set_config('gestao.autom_depth', (v_depth + 1)::text, true);
  foreach v_id in array coalesce(p_ids, '{}'::text[]) loop
    select * into t from public.gestao_tarefas where id_tarefa = v_id;
    if not found or t.id_quadro <> a.id_quadro or not public.gestao_ve_tarefa(v_id)
       or public.gestao_nivel_ord(public.gestao_resolver_nivel(v_email, 'task', v_id)) < 2 then
      v_ign := v_ign + 1;
      continue;
    end if;
    perform public.gestao_automacao_aplicar(a, t, 'manual',
      public.gestao_automacao_ctx(t, jsonb_build_object('vars', jsonb_build_object('executado_por', coalesce(v_nome, v_email, '')))));
    v_ok := v_ok + 1;
  end loop;
  perform set_config('gestao.autom_depth', v_depth::text, true);
  return jsonb_build_object('executadas', v_ok, 'ignoradas', v_ign);
end $$;

revoke all on function public.gestao_automacao_escolher(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.gestao_automacao_acao_rodizio(public.gestao_automacoes, jsonb, public.gestao_tarefas) from public, anon, authenticated;
revoke all on function public.gestao_automacao_executar(public.gestao_automacoes, jsonb, public.gestao_tarefas, text, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.gestao_automacao_executar_manual(uuid, text[]) from public, anon;
grant execute on function public.gestao_automacao_executar_manual(uuid, text[]) to authenticated, service_role;

notify pgrst, 'reload schema';
