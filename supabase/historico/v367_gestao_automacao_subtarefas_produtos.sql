-- v367 — Automações: ações nas SUBTAREFAS do cartão e "Criar subtarefas a partir dos Produtos" (23/11/2026, 0.3.319).
--
-- POR QUÊ: pedido do João (print da janela de Automações): (1) as ações viram um tópico só, "Tarefa"; (2) um segundo
-- tópico, "Subtarefas", com as mesmas ações, que rodam em CADA subtarefa do cartão; (3) "tudo que for produto vira
-- subtarefa" — cada Produto marcado no cartão vira uma subtarefa.
--
-- O QUE FAZ (sem reescrever as funções grandes: lê a definição atual e troca/insere só o trecho):
--   1. gestao_subtarefa_abrir_automacao(id): abre a "janela" (tarefa filha) da subtarefa, como a RPC
--      gestao_subtarefa_abrir, mas sem conferir o login (a automação roda no servidor) e com created_by 'automacao'.
--   2. gestao_automacao_nas_subtarefas(...): roda UMA ação em cada subtarefa do cartão (abrindo a filha quando
--      preciso). O "só se…" da ação é testado por subtarefa (vale "o nome da subtarefa contém…" e as condições do
--      cartão). Não vale para: aguardar, criar subtarefas (modelo/produtos) e mover para outro quadro.
--   3. gestao_automacao_executar: ação com "alvo": "subtarefas" vai para a função do item 2 (o "só se…" dela
--      deixa de ser testado no cartão).
--   4. gestao_automacao_acao: nova ação 'criar_subtarefas_produtos' — para cada valor marcado no campo (padrão:
--      Produtos; opcionalmente só alguns): se o quadro tem um modelo de subtarefas com o nome do produto, cria os
--      itens dele (com etapa e tipo, como o "[SST] Checklist <produto>"); senão, uma subtarefa com o título da ação
--      ("{produto}", aceita variáveis). Não repete subtarefa com o mesmo nome. Responsável: o da ação ou, sem ele,
--      o "Funcionários por produto" do quadro (daquele produto). Uma regra só substitui as regras por produto.
--   5. gestao_automacao_completa: a ação nova é sempre completa (o campo tem padrão).
--
-- REAPLICAR: idempotente (cada troca confere o marcador 'v367'). ROLLBACK: scripts/sql/v367_gestao_automacao_subtarefas_produtos_rollback.sql
begin;

-- ── 1. abrir a filha da subtarefa, pela automação ─────────────────────────────────────────────
create or replace function public.gestao_subtarefa_abrir_automacao(p_id_subtarefa text)
 returns text language plpgsql security definer set search_path to 'public'
as $function$
declare s record; v_pai record; v_id text;
begin
  select * into s from public.gestao_subtarefas where id = p_id_subtarefa for update;
  if not found then return null; end if;
  if s.id_tarefa_filha is not null then return s.id_tarefa_filha; end if;
  select id_tarefa, id_quadro, id_unidade into v_pai from public.gestao_tarefas where id_tarefa = s.id_tarefa;
  if not found then return null; end if;

  v_id := 'TRF-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));
  perform set_config('gestao.sync_sub', 'on', true);
  insert into public.gestao_tarefas (id_tarefa, id_quadro, titulo, status, id_tarefa_pai, id_unidade, created_by, created_at, updated_at)
  values (v_id, v_pai.id_quadro, s.texto, public.gestao_status_para_feito(v_pai.id_quadro, s.feito),
          v_pai.id_tarefa, v_pai.id_unidade, 'automacao', now(), now());
  if s.responsavel_email is not null then
    insert into public.gestao_tarefa_vinculados (id_tarefa, usuario_email, tipo, origem)
    values (v_id, lower(s.responsavel_email), 'responsavel', 'subtarefa')
    on conflict do nothing;
  end if;
  insert into public.gestao_tarefa_vinculados (id_tarefa, usuario_email, tipo, origem)
  select distinct v_id, lower(a ->> 'email'), 'responsavel', 'subtarefa'
    from jsonb_array_elements(case when jsonb_typeof(s.alocados) = 'array' then s.alocados else '[]'::jsonb end) a
   where coalesce(a ->> 'email', '') <> ''
     and exists (select 1 from public.usuarios u where lower(u.email) = lower(a ->> 'email'))
  on conflict do nothing;
  update public.gestao_subtarefas set id_tarefa_filha = v_id where id = s.id;
  perform set_config('gestao.sync_sub', '', true);
  return v_id;
end $function$;
revoke all on function public.gestao_subtarefa_abrir_automacao(text) from public, anon, authenticated;

-- ── 2. uma ação em cada subtarefa ─────────────────────────────────────────────────────────────
create or replace function public.gestao_automacao_nas_subtarefas(
  p_autom public.gestao_automacoes, p_acao jsonb, p_tarefa public.gestao_tarefas, p_gatilho text, p_ctx jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_acao jsonb := coalesce(p_acao, '{}'::jsonb) - 'alvo' - 'condicao';
  v_cond jsonb := p_acao->'condicao';
  s public.gestao_subtarefas;
  v_filha public.gestao_tarefas;
  v_id text; v_ctx jsonb; v_r jsonb; v_erro text;
  n_ok int := 0; n_skip int := 0; n_erro int := 0; n_fora int := 0;
begin
  if coalesce(v_acao->>'tipo', '') in ('aguardar', 'criar_subtarefas_modelo', 'criar_subtarefas_produtos', 'mover_tarefa_quadro') then
    return jsonb_build_object('res', 'skip', 'det', 'ação não vale para subtarefas: ' || coalesce(v_acao->>'tipo', '?'));
  end if;
  for s in select * from public.gestao_subtarefas where id_tarefa = p_tarefa.id_tarefa order by ordem, created_at loop
    -- o cartão + a subtarefa (nome, tipo, etapa, responsável e as variáveis {subtarefa}…)
    v_ctx := (coalesce(p_ctx, '{}'::jsonb)
              || jsonb_build_object('subtarefa_id', s.id, 'subtarefa_texto', s.texto, 'subtarefa_tipo', s.tipo,
                                    'subtarefa_etapa', s.etapa, 'subtarefa_responsavel', lower(coalesce(s.responsavel_email, ''))))
             || jsonb_build_object('vars', coalesce(p_ctx->'vars', '{}'::jsonb) || jsonb_build_object('subtarefa', coalesce(s.texto, '')));
    if v_cond is not null and (v_cond ? 'all' or v_cond ? 'any') and not public.gestao_automacao_cond_bate(v_cond, v_ctx) then
      n_fora := n_fora + 1;
      continue;
    end if;
    v_id := coalesce(s.id_tarefa_filha, public.gestao_subtarefa_abrir_automacao(s.id));
    select * into v_filha from public.gestao_tarefas where id_tarefa = v_id;
    if not found then
      n_erro := n_erro + 1; v_erro := coalesce(v_erro, 'subtarefa sem janela: ' || s.texto);
      continue;
    end if;
    v_r := case when v_acao->>'tipo' = 'atribuir_rodizio'
                then public.gestao_automacao_acao_rodizio(p_autom, v_acao, v_filha)
                else public.gestao_automacao_acao(p_autom, v_acao, v_filha, p_gatilho, public.gestao_automacao_ctx(v_filha, v_ctx)) end;
    if v_r->>'res' = 'ok' then n_ok := n_ok + 1;
    elsif v_r->>'res' = 'erro' then n_erro := n_erro + 1; v_erro := coalesce(v_erro, v_r->>'det');
    else n_skip := n_skip + 1;
    end if;
  end loop;
  if n_ok + n_skip + n_erro + n_fora = 0 then
    return jsonb_build_object('res', 'skip', 'det', 'o cartão não tem subtarefas');
  end if;
  return jsonb_build_object(
    'res', case when n_ok > 0 then 'ok' when n_erro > 0 then 'erro' else 'skip' end,
    'det', 'nas subtarefas: ' || n_ok || ' feita(s)'
           || case when n_skip > 0 then ', ' || n_skip || ' sem mudança' else '' end
           || case when n_fora > 0 then ', ' || n_fora || ' fora do "só se"' else '' end
           || case when n_erro > 0 then ', ' || n_erro || ' com erro (' || left(coalesce(v_erro, ''), 200) || ')' else '' end);
exception when others then
  return jsonb_build_object('res', 'erro', 'det', left(SQLERRM, 300));
end $function$;
revoke all on function public.gestao_automacao_nas_subtarefas(public.gestao_automacoes, jsonb, public.gestao_tarefas, text, jsonb) from public, anon, authenticated;

-- ── 3–5. trocas nas funções atuais ────────────────────────────────────────────────────────────
do $$
declare
  v_fn regprocedure; v_def text; v_novo text;
begin
  -- 3. executar: alvo "subtarefas"
  select p.oid::regprocedure into v_fn from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'gestao_automacao_executar';
  if v_fn is null then raise exception 'v367: gestao_automacao_executar não encontrada'; end if;
  v_def := pg_get_functiondef(v_fn);
  if position('v367: alvo subtarefas' in v_def) = 0 then
    v_novo := regexp_replace(v_def,
      'if \(v_acao->''condicao''\) is not null and',
      E'-- v367: alvo subtarefas — o "só se…" é testado em cada subtarefa (gestao_automacao_nas_subtarefas).\n    if coalesce(v_acao->>''alvo'', '''') <> ''subtarefas'' and (v_acao->''condicao'') is not null and');
    if v_novo = v_def then raise exception 'v367: teste do "só se" não encontrado em gestao_automacao_executar'; end if;
    v_def := v_novo;
    v_novo := regexp_replace(v_def,
      'v_r := case when v_acao->>''tipo'' = ''atribuir_rodizio''',
      E'v_r := case when v_acao->>''alvo'' = ''subtarefas''\n                then public.gestao_automacao_nas_subtarefas(p_autom, v_acao, v_tarefa, p_gatilho, v_ctx)\n                when v_acao->>''tipo'' = ''atribuir_rodizio''');
    if v_novo = v_def then raise exception 'v367: chamada da ação não encontrada em gestao_automacao_executar'; end if;
    execute v_novo;
  else
    raise notice 'v367: executar já trocado';
  end if;

  -- 4. ação nova: criar_subtarefas_produtos
  select p.oid::regprocedure into v_fn from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'gestao_automacao_acao';
  if v_fn is null then raise exception 'v367: gestao_automacao_acao não encontrada'; end if;
  v_def := pg_get_functiondef(v_fn);
  if position('v367 início' in v_def) = 0 then
    v_novo := regexp_replace(v_def,
      '(\n\s*elsif v_tipo = ''mover_status_se_completo'')',
      E'\n    -- v367 início: criar_subtarefas_produtos — uma subtarefa por valor do campo (padrão: Produtos).\n'
      '    elsif v_tipo = ''criar_subtarefas_produtos'' then\n'
      '      declare\n'
      '        v_campo text := coalesce(nullif(v_acao->>''campo_id'', ''''), ''eb5d9daf-9b81-4903-bfd5-4fea654225e7'');\n'
      '        v_val jsonb := coalesce(p_tarefa.campos, ''{}''::jsonb) -> coalesce(nullif(v_acao->>''campo_id'', ''''), ''eb5d9daf-9b81-4903-bfd5-4fea654225e7'');\n'
      '        v_prods text[]; v_so text[]; v_p text; v_resp text; v_t text; v_mod public.gestao_subtarefa_modelos;\n'
      '      begin\n'
      '        v_prods := case jsonb_typeof(v_val)\n'
      '          when ''array'' then array(select btrim(x) from jsonb_array_elements_text(v_val) x where btrim(x) <> '''')\n'
      '          when ''string'' then array(select btrim(x) from unnest(string_to_array(v_val #>> ''{}'', '','')) x where btrim(x) <> '''')\n'
      '          else ''{}''::text[] end;\n'
      '        v_so := array(select btrim(x) from jsonb_array_elements_text(\n'
      '                  case when jsonb_typeof(v_acao->''produtos'') = ''array'' then v_acao->''produtos'' else ''[]''::jsonb end) x where btrim(x) <> '''');\n'
      '        if cardinality(v_prods) = 0 then\n'
      '          v_res := ''skip''; v_det := ''o campo está vazio'';\n'
      '        else\n'
      '          select coalesce(max(ordem), -1) + 1 into v_ordem from public.gestao_subtarefas where id_tarefa = p_tarefa.id_tarefa;\n'
      '          foreach v_p in array v_prods loop\n'
      '            if cardinality(v_so) > 0 and not (v_p = any (v_so)) then continue; end if;\n'
      '            v_resp := null;\n'
      '            select lower(u.email) into v_resp from public.usuarios u\n'
      '             where lower(u.email) = lower(btrim(coalesce(v_acao->>''responsavel_email'', '''')))\n'
      '               and coalesce(u.ativo_sistema, true) and u.perfil <> ''Cliente'';\n'
      '            if v_resp is null then\n'
      '              select lower(u.email) into v_resp\n'
      '                from public.gestao_produto_responsaveis r\n'
      '                join public.usuarios u on lower(u.email) = lower(r.usuario_email)\n'
      '               where r.id_quadro = p_tarefa.id_quadro and v_p = any (r.produtos)\n'
      '                 and coalesce(u.ativo_sistema, true) and u.perfil <> ''Cliente''\n'
      '               order by r.ordem, r.created_at limit 1;\n'
      '            end if;\n'
      '            -- o quadro tem modelo de subtarefas com o nome do produto? usa os itens dele (etapa e tipo); senão, uma\n'
      '            -- subtarefa com o título da ação ({produto}).\n'
      '            v_mod := null;\n'
      '            select * into v_mod from public.gestao_subtarefa_modelos m\n'
      '             where m.id_quadro = p_tarefa.id_quadro and lower(btrim(m.titulo)) = lower(v_p)\n'
      '               and jsonb_typeof(m.itens) = ''array'' and jsonb_array_length(m.itens) > 0\n'
      '             order by m.slug limit 1;\n'
      '            for v_item in\n'
      '              select value from jsonb_array_elements(coalesce(v_mod.itens, jsonb_build_array(jsonb_build_object(''texto'',\n'
      '                public.gestao_automacao_texto(coalesce(nullif(v_acao->>''titulo_template'', ''''), ''{produto}''), p_tarefa,\n'
      '                  coalesce(p_ctx, ''{}''::jsonb) || jsonb_build_object(''vars'', coalesce(p_ctx->''vars'', ''{}''::jsonb) || jsonb_build_object(''produto'', v_p)))))))\n'
      '            loop\n'
      '              v_t := left(btrim(coalesce(v_item->>''texto'', '''')), 500);\n'
      '              if v_t = '''' then continue; end if;\n'
      '              if exists (select 1 from public.gestao_subtarefas where id_tarefa = p_tarefa.id_tarefa and lower(btrim(texto)) = lower(v_t)) then continue; end if;\n'
      '              insert into public.gestao_subtarefas (id, id_tarefa, texto, ordem, etapa, tipo, responsavel_email)\n'
      '              values (''SUB-'' || upper(substring(replace(gen_random_uuid()::text, ''-'', '''') from 1 for 8)), p_tarefa.id_tarefa, v_t, v_ordem,\n'
      '                      nullif(v_item->>''etapa'', ''''), nullif(v_item->>''tipo'', ''''), v_resp);\n'
      '              v_ordem := v_ordem + 1; v_ins := v_ins + 1;\n'
      '            end loop;\n'
      '          end loop;\n'
      '          if v_ins = 0 then\n'
      '            v_res := ''skip''; v_det := ''as subtarefas dos produtos já existiam'';\n'
      '          else\n'
      '            v_det := ''subtarefas dos produtos: '' || v_ins;\n'
      '          end if;\n'
      '        end if;\n'
      '      end;\n'
      '    -- v367 fim\\1');
    if v_novo = v_def then raise exception 'v367: ponto de inserção não encontrado em gestao_automacao_acao'; end if;
    execute v_novo;
  else
    raise notice 'v367: ação já inserida';
  end if;

  -- 5. completa: a ação nova é sempre completa
  select p.oid::regprocedure into v_fn from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'gestao_automacao_completa';
  if v_fn is null then raise exception 'v367: gestao_automacao_completa não encontrada'; end if;
  v_def := pg_get_functiondef(v_fn);
  if position('criar_subtarefas_produtos' in v_def) = 0 then
    v_novo := regexp_replace(v_def,
      '(\n\s*when ''criar_subtarefas_modelo''[^\n]*)',
      E'\\1\n    when ''criar_subtarefas_produtos'' then true  -- v367');
    if v_novo = v_def then raise exception 'v367: criar_subtarefas_modelo não encontrado em gestao_automacao_completa'; end if;
    execute v_novo;
  else
    raise notice 'v367: completa já trocada';
  end if;
end $$;

commit;
