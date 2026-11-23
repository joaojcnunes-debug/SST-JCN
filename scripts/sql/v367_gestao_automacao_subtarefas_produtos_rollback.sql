-- ROLLBACK v367 — tira as ações nas subtarefas e a "Criar subtarefas a partir dos Produtos".
-- As subtarefas e janelas já criadas pelas automações ficam (são dados do cartão). Regras que usam a ação nova ou o
-- alvo "subtarefas" passam a registrar "ação não reconhecida"/rodar no cartão: desligue-as antes.
begin;

do $$
declare
  v_fn regprocedure; v_def text; v_novo text;
begin
  select p.oid::regprocedure into v_fn from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'gestao_automacao_executar';
  v_def := pg_get_functiondef(v_fn);
  if position('v367: alvo subtarefas' in v_def) > 0 then
    v_novo := regexp_replace(v_def,
      '-- v367: alvo subtarefas[^\n]*\n\s*if coalesce\(v_acao->>''alvo'', ''''\) <> ''subtarefas'' and \(v_acao->''condicao''\) is not null and',
      'if (v_acao->''condicao'') is not null and');
    v_novo := regexp_replace(v_novo,
      'v_r := case when v_acao->>''alvo'' = ''subtarefas''\s+then public\.gestao_automacao_nas_subtarefas\(p_autom, v_acao, v_tarefa, p_gatilho, v_ctx\)\s+when v_acao->>''tipo'' = ''atribuir_rodizio''',
      'v_r := case when v_acao->>''tipo'' = ''atribuir_rodizio''');
    if position('v367' in v_novo) > 0 then raise exception 'rollback v367: executar não voltou'; end if;
    execute v_novo;
  end if;

  select p.oid::regprocedure into v_fn from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'gestao_automacao_acao';
  v_def := pg_get_functiondef(v_fn);
  if position('v367 início' in v_def) > 0 then
    v_novo := regexp_replace(v_def, '\n\s*-- v367 início:.*?-- v367 fim', '');
    if position('v367' in v_novo) > 0 then raise exception 'rollback v367: ação não saiu'; end if;
    execute v_novo;
  end if;

  select p.oid::regprocedure into v_fn from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'gestao_automacao_completa';
  v_def := pg_get_functiondef(v_fn);
  if position('criar_subtarefas_produtos' in v_def) > 0 then
    v_novo := regexp_replace(v_def, '\n\s*when ''criar_subtarefas_produtos'' then true  -- v367', '');
    if position('criar_subtarefas_produtos' in v_novo) > 0 then raise exception 'rollback v367: completa não voltou'; end if;
    execute v_novo;
  end if;
end $$;

drop function if exists public.gestao_automacao_nas_subtarefas(public.gestao_automacoes, jsonb, public.gestao_tarefas, text, jsonb);
drop function if exists public.gestao_subtarefa_abrir_automacao(text);

commit;
