-- v301 (JCN) — Gestão: automações, Pacote D — integração com o SST (levantamento de 26/10/2026).
--
-- Gatilhos que nascem FORA da Gestão. A regra fica num quadro; quando o evento acontece, ela cria uma
-- tarefa nesse quadro a partir do modelo (condicao.modelo_tarefa, o mesmo da agenda) e roda as ações.
--   sst_inspecao_concluida     a inspeção foi concluída pela 1ª vez (inspecoes.primeira_conclusao_em
--                              preenchida — reabrir e concluir de novo não dispara outra vez)
--   sst_documento_concluido    o documento (elaboração) foi concluído pela 1ª vez (primeira_elaboracao_em)
--   sst_vencimento             documento (inspecoes.data_validade) ou extintor (extintores.data_validade)
--                              vence em N dias — checado pelo relógio, 1x por item e validade
-- Variáveis: {empresa} {unidade} {tecnico} {data_inspecao} {validade} {dias_para_vencer} {item}
--            {responsavel_elaboracao} {id_inspecao}
-- Condições (E/OU): empresa (contém), unidade (id), técnico, fonte (documento|extintor).
-- O evento nunca derruba a gravação da inspeção: erro vai para o log.
--
-- REAPLICAR: idempotente. ROLLBACK: scripts/sql/v301_gestao_automacoes_pacote_d_rollback.sql

-- ── 1) Condições: campos do SST ─────────────────────────────────────────────
create or replace function public.gestao_automacao_cond_teste(p_clause jsonb, p_ctx jsonb) returns boolean
  language plpgsql stable security definer set search_path = public as $$
declare
  f    text  := p_clause->>'campo';
  op   text  := lower(coalesce(p_clause->>'op', '='));
  val  jsonb := p_clause->'valor';
  val_txt text := case when val is null then null when jsonb_typeof(val) = 'string' then val #>> '{}' else val::text end;
  fval text;
  farr jsonb := null;
begin
  if f is null then
    return false;
  elsif f = 'etiqueta' then
    farr := coalesce(p_ctx->'etiquetas', '[]'::jsonb);
  elsif f like 'campo:%' then
    if jsonb_typeof(p_ctx->'campos'->substring(f from 7)) = 'array' then
      farr := p_ctx->'campos'->substring(f from 7);
    else
      fval := p_ctx->'campos'->>substring(f from 7);
    end if;
  elsif f in ('subtarefa', 'subtarefa_texto') then
    fval := p_ctx->>'subtarefa_texto';
  elsif f in ('subtarefa_etapa', 'subtarefa_tipo', 'status', 'status_de', 'status_para', 'prioridade', 'quadro',
              'responsavel', 'responsavel_email', 'titulo', 'origem', 'dia_semana', 'prazo_estado',
              'campo_alterado', 'etiqueta_nova', 'prioridade_de',
              -- v301 (SST)
              'empresa', 'unidade', 'tecnico', 'fonte') then
    fval := p_ctx->>f;
  elsif f in ('comentario', 'comentario_texto') then
    fval := p_ctx->>'comentario_texto';
  else
    return false;
  end if;

  if op = 'vazio' then
    return case when farr is not null then jsonb_array_length(farr) = 0 else coalesce(fval, '') = '' end;
  elsif op = 'nao_vazio' then
    return case when farr is not null then jsonb_array_length(farr) > 0 else coalesce(fval, '') <> '' end;
  end if;

  if farr is not null then
    if op in ('=', 'contains') then
      if jsonb_typeof(val) = 'array' then return farr @> val; end if;
      return farr ? coalesce(val_txt, '');
    elsif op = 'in' then
      if jsonb_typeof(val) = 'array' then
        return exists (select 1 from jsonb_array_elements_text(val) e where farr ? e);
      end if;
      return exists (select 1 from unnest(string_to_array(coalesce(val_txt, ''), ',')) e where farr ? btrim(e));
    elsif op in ('!=', 'nao_contem') then
      return not (farr ? coalesce(val_txt, ''));
    end if;
    return false;
  end if;

  if op = '=' then
    return fval is not distinct from val_txt;
  elsif op = '!=' then
    return fval is distinct from val_txt;
  elsif op = 'in' then
    if jsonb_typeof(val) = 'array' then
      return exists (select 1 from jsonb_array_elements_text(val) e where e = fval);
    end if;
    return exists (select 1 from unnest(string_to_array(coalesce(val_txt, ''), ',')) e where btrim(e) = fval);
  elsif op = 'contains' then
    return fval is not null and val_txt is not null and position(lower(val_txt) in lower(fval)) > 0;
  elsif op = 'nao_contem' then
    return val_txt is not null and position(lower(val_txt) in lower(coalesce(fval, ''))) = 0;
  end if;
  return false;
end $$;

-- ── 2) Completude dos gatilhos do SST ───────────────────────────────────────
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
    when p_gatilho in ('sst_inspecao_concluida', 'sst_documento_concluido', 'sst_vencimento') then
      public.gestao_modelo_tarefa_valido(p_condicao->'modelo_tarefa')
      and (jsonb_array_length(coalesce(p_acoes, '[]'::jsonb)) = 0 or public.gestao_automacao_completa_lista(p_acoes))
      and (p_gatilho <> 'sst_vencimento'
           or (coalesce(p_condicao->>'fonte', '') in ('documento', 'extintor')
               and coalesce(p_condicao->>'dias_antes', '') ~ '^[0-9]+$'))
    else public.gestao_automacao_completa_lista(p_acoes)
  end, false);
$$;

-- ── 3) Contexto de uma inspeção ─────────────────────────────────────────────
create or replace function public.gestao_sst_ctx_inspecao(p_id_inspecao text) returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'empresa', coalesce(e.nome_empresa, ''),
    'unidade', coalesce(e.id_unidade, ''),
    'tecnico', coalesce((
      select string_agg(distinct coalesce(u.nome, nullif(btrim(t->>'digitado'), '')), ', ')
        from jsonb_array_elements(coalesce(i.primeira_conclusao_tecnicos, '[]'::jsonb)) t
        left join public.usuarios u on u.id_usuario = t->>'idUsuario'),
      (select string_agg(distinct coalesce(u.nome, nullif(btrim(r.tecnico_responsavel), '')), ', ')
         from public.responsaveis r left join public.usuarios u on u.id_usuario = r.id_usuario
        where r.id_inspecao = i.id_inspecao),
      i.responsavel, ''),
    'vars', jsonb_build_object(
      'empresa', coalesce(e.nome_empresa, ''),
      'unidade', coalesce(un.nome, ''),
      'id_inspecao', i.id_inspecao,
      'data_inspecao', coalesce(public.gestao_data_br(i.data_inspecao), ''),
      'responsavel_elaboracao', coalesce(i.elaboracao_responsavel, ''),
      'tecnico', coalesce((
        select string_agg(distinct coalesce(u.nome, nullif(btrim(t->>'digitado'), '')), ', ')
          from jsonb_array_elements(coalesce(i.primeira_conclusao_tecnicos, '[]'::jsonb)) t
          left join public.usuarios u on u.id_usuario = t->>'idUsuario'),
        (select string_agg(distinct coalesce(u.nome, nullif(btrim(r.tecnico_responsavel), '')), ', ')
           from public.responsaveis r left join public.usuarios u on u.id_usuario = r.id_usuario
          where r.id_inspecao = i.id_inspecao),
        i.responsavel, '')),
    'origem_extra', jsonb_build_object('tipo', 'sst', 'id_inspecao', i.id_inspecao, 'id_empresa', i.id_empresa))
  from public.inspecoes i
  left join public.empresas e on e.id_empresa = i.id_empresa
  left join public.unidades un on un.id_unidade = e.id_unidade
  where i.id_inspecao = p_id_inspecao;
$$;

-- ── 4) Disparar um evento do SST ────────────────────────────────────────────
-- Para cada regra ativa do gatilho que casar: cria a tarefa do modelo no quadro da regra e roda as ações.
-- A chave impede repetir o mesmo evento para a mesma regra.
create or replace function public.gestao_automacao_evento_sst(p_evento text, p_ctx jsonb, p_chave text) returns int
  language plpgsql security definer set search_path = public as $$
declare a public.gestao_automacoes; t public.gestao_tarefas; v_n int := 0; v_depth int;
begin
  v_depth := coalesce(nullif(current_setting('gestao.autom_depth', true), ''), '0')::int;
  if v_depth >= 3 then return 0; end if;
  perform set_config('gestao.autom_depth', (v_depth + 1)::text, true);
  for a in select * from public.gestao_automacoes where ativo and gatilho = p_evento order by ordem loop
    begin
      if exists (select 1 from public.gestao_automacao_log l
                  where l.id_automacao = a.id and l.chave = p_chave and l.resultado <> 'erro') then continue; end if;
      if ((a.condicao ? 'all') or (a.condicao ? 'any')) and not public.gestao_automacao_cond_bate(a.condicao, p_ctx) then continue; end if;
      t := public.gestao_automacao_criar_tarefa(a, a.condicao->'modelo_tarefa', p_ctx);
      perform public.gestao_automacao_executar(a, a.acoes, t, p_evento, public.gestao_automacao_ctx(t, p_ctx - 'origem_extra'),
                                               p_chave, 'tarefa criada: ' || t.titulo);
      v_n := v_n + 1;
    exception when others then
      insert into public.gestao_automacao_log (id_automacao, gatilho, resultado, detalhe, chave)
      values (a.id, p_evento, 'erro', left(SQLERRM, 300), p_chave);
    end;
  end loop;
  perform set_config('gestao.autom_depth', v_depth::text, true);
  return v_n;
end $$;

-- ── 5) Gatilho na inspeção: 1ª conclusão da inspeção e do documento ─────────
create or replace function public.gestao_automacao_inspecao_trg() returns trigger
  language plpgsql security definer set search_path = public as $$
declare v_ctx jsonb;
begin
  begin
    if new.primeira_conclusao_em is not null and (tg_op = 'INSERT' or old.primeira_conclusao_em is null) then
      v_ctx := public.gestao_sst_ctx_inspecao(new.id_inspecao);
      perform public.gestao_automacao_evento_sst('sst_inspecao_concluida', v_ctx, 'insp:' || new.id_inspecao);
    end if;
    if new.primeira_elaboracao_em is not null and (tg_op = 'INSERT' or old.primeira_elaboracao_em is null) then
      v_ctx := public.gestao_sst_ctx_inspecao(new.id_inspecao);
      perform public.gestao_automacao_evento_sst('sst_documento_concluido', v_ctx, 'doc:' || new.id_inspecao);
    end if;
  exception when others then
    insert into public.gestao_automacao_log (gatilho, resultado, detalhe) values ('sst_inspecao', 'erro', left(SQLERRM, 300));
  end;
  return null;
end $$;

drop trigger if exists trg_inspecoes_automacao_sst on public.inspecoes;
-- WHEN (não "UPDATE OF"): as colunas são preenchidas pelo gatilho BEFORE inspecoes_primeira_conclusao,
-- e "UPDATE OF" só dispara para coluna que está no SET do comando.
create trigger trg_inspecoes_automacao_sst after update on public.inspecoes
  for each row when (old.primeira_conclusao_em is distinct from new.primeira_conclusao_em
                     or old.primeira_elaboracao_em is distinct from new.primeira_elaboracao_em)
  execute function public.gestao_automacao_inspecao_trg();
drop trigger if exists trg_inspecoes_automacao_sst_ins on public.inspecoes;
create trigger trg_inspecoes_automacao_sst_ins after insert on public.inspecoes
  for each row when (new.primeira_conclusao_em is not null or new.primeira_elaboracao_em is not null)
  execute function public.gestao_automacao_inspecao_trg();

-- ── 6) Vencimentos (o relógio chama 1x por tick; a chave evita repetir) ─────
create or replace function public.gestao_automacao_vencimentos() returns int
  language plpgsql security definer set search_path = public as $$
declare
  a public.gestao_automacoes; r record; v_ctx jsonb; v_n int := 0; v_dias int;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  for a in select * from public.gestao_automacoes where ativo and gatilho = 'sst_vencimento' order by ordem loop
    v_dias := coalesce(nullif(a.condicao->>'dias_antes', '')::int, 30);
    for r in
      select 'documento'::text as fonte, i.id_inspecao as id_item, i.id_inspecao, i.data_validade as validade,
             'Documento da inspeção ' || i.id_inspecao as item
        from public.inspecoes i
       where a.condicao->>'fonte' = 'documento' and i.status <> 'DELETADA' and i.data_validade is not null
         and i.data_validade between v_hoje and v_hoje + v_dias
         -- só o documento mais recente da empresa (o renovado substitui o antigo)
         and not exists (select 1 from public.inspecoes n where n.id_empresa = i.id_empresa and n.status <> 'DELETADA'
                           and n.data_validade > i.data_validade)
      union all
      select 'extintor', x.id_extintor, x.id_inspecao, x.data_validade,
             concat_ws(' ', 'Extintor', nullif(x.tipo_agente, ''), nullif(x.capacidade, ''),
                       case when coalesce(x.numero_identificacao, '') <> '' then 'nº ' || x.numero_identificacao end,
                       case when coalesce(x.localizacao, '') <> '' then '(' || x.localizacao || ')' end)
        from public.extintores x
       where a.condicao->>'fonte' = 'extintor' and coalesce(x.ativo, true) and x.data_validade is not null
         and x.data_validade between v_hoje and v_hoje + v_dias
      limit 500
    loop
      v_ctx := coalesce(public.gestao_sst_ctx_inspecao(r.id_inspecao), '{}'::jsonb);
      v_ctx := v_ctx || jsonb_build_object('fonte', r.fonte,
        'vars', coalesce(v_ctx->'vars', '{}'::jsonb) || jsonb_build_object(
                  'validade', public.gestao_data_br(r.validade),
                  'dias_para_vencer', (r.validade - v_hoje)::text,
                  'item', r.item),
        'origem_extra', coalesce(v_ctx->'origem_extra', '{}'::jsonb) || jsonb_build_object('fonte', r.fonte, 'id_item', r.id_item));
      v_n := v_n + public.gestao_automacao_evento_sst('sst_vencimento', v_ctx, 'venc:' || r.fonte || ':' || r.id_item || ':' || r.validade);
    end loop;
  end loop;
  return v_n;
end $$;

-- o relógio passa a chamar os vencimentos (uma vez por tick, a partir das 7h)
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.gestao_automacao_relogio()'::regprocedure);
  if position('gestao_automacao_vencimentos' in v_def) = 0 then
    v_def := replace(v_def,
      '  perform set_config(''gestao.autom_depth'', v_depth::text, true);
  return jsonb_build_object(''rodou'', true,',
      '  if v_agora::time >= time ''07:00'' then
    perform public.gestao_automacao_vencimentos();
  end if;

  perform set_config(''gestao.autom_depth'', v_depth::text, true);
  return jsonb_build_object(''rodou'', true,');
    if position('gestao_automacao_vencimentos' in v_def) = 0 then
      raise exception 'v301: não achei o ponto de inserção no gestao_automacao_relogio';
    end if;
    execute v_def;
  end if;
end $$;

-- ── 7) Permissões ───────────────────────────────────────────────────────────
revoke all on function public.gestao_sst_ctx_inspecao(text) from public, anon, authenticated;
revoke all on function public.gestao_automacao_evento_sst(text, jsonb, text) from public, anon, authenticated;
revoke all on function public.gestao_automacao_inspecao_trg() from public, anon, authenticated;
revoke all on function public.gestao_automacao_vencimentos() from public, anon, authenticated;
revoke all on function public.gestao_automacao_relogio() from public, anon, authenticated;
grant execute on function public.gestao_automacao_relogio() to service_role;

notify pgrst, 'reload schema';
