-- v366 — Automação "criar tarefa no quadro da unidade": escolher a LISTA DA UNIDADE, não a Agenda da unidade
-- (23/11/2026, 0.3.318).
--
-- POR QUÊ: pedido do João (print do Painel): o cartão "Teste automação 2 Friburgo", concluído no Comercial COM
-- Produtos, não apareceu em Friburgo › Empresas Novas. O destino '@unidade' pegava o PRIMEIRO quadro com aquela
-- unidade, só pela `ordem`. No Painel as listas "Agenda · <unidade>" (11/11/2026) também têm `id_unidade` —
-- então, conforme a ordem, a tarefa nova ia parar na Agenda (e na 1ª coluna dela, porque a Agenda não tem a
-- coluna de destino). No JCN ainda não há Agenda por unidade, mas a regra é a mesma.
--
-- O QUE FAZ: troca SÓ a ordenação da busca do quadro da unidade dentro de `gestao_automacao_acao`, sem reescrever
-- a função (ela tem outras diferenças entre o JCN e o Painel). A ordem passa a ser:
--   1º o quadro que tem a coluna de destino da ação (ex.: EMPRESAS_NOVAS);
--   2º o que NÃO se chama "Agenda…";
--   3º a `ordem` de antes, e o id para desempatar (antes o empate era aleatório).
-- Feito com a definição atual (pg_get_functiondef) + troca do trecho; se o trecho não for achado, para com erro.
--
-- REAPLICAR: idempotente (já trocado → avisa e não mexe). ROLLBACK: scripts/sql/v366_gestao_quadro_da_unidade_sem_agenda_rollback.sql
begin;

do $$
declare
  v_fn regprocedure;
  v_def text;
  v_novo text;
begin
  select p.oid::regprocedure into v_fn
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'gestao_automacao_acao';
  if v_fn is null then raise exception 'v366: função gestao_automacao_acao não encontrada'; end if;
  v_def := pg_get_functiondef(v_fn);

  if position('v366: lista da unidade' in v_def) > 0 then
    raise notice 'v366: já aplicada, nada a fazer';
    return;
  end if;

  v_novo := regexp_replace(
    v_def,
    '(and q\.id_unidade = coalesce\(p_tarefa\.id_unidade, public\.gestao_unidade_de_etiquetas\(p_tarefa\.etiquetas\)\))\s+order by q\.ordem limit 1;',
    E'\\1\n'
    '         -- v366: lista da unidade primeiro (a que tem a coluna de destino; nunca a "Agenda · unidade").\n'
    '         order by exists (select 1 from public.gestao_status s\n'
    '                           where s.id_quadro = q.id_quadro and s.slug = nullif(v_acao->>''status_destino'', '''')) desc,\n'
    '                  (lower(q.nome) like ''agenda%'') asc, q.ordem, q.id_quadro\n'
    '         limit 1;');
  if v_novo = v_def then
    raise exception 'v366: trecho da busca do quadro da unidade não encontrado em gestao_automacao_acao (a função mudou?)';
  end if;
  execute v_novo;
end $$;

commit;
