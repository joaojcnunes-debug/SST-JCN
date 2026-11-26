-- ROLLBACK v366 — volta a busca do quadro da unidade a "primeiro pela ordem" (pode voltar a cair na Agenda da unidade).
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
  v_def := pg_get_functiondef(v_fn);
  if position('v366: lista da unidade' in v_def) = 0 then
    raise notice 'rollback v366: não estava aplicada';
    return;
  end if;
  v_novo := regexp_replace(
    v_def,
    '\s+-- v366: lista da unidade[^\n]*\n\s+order by exists \(select 1 from public\.gestao_status s\s+where s\.id_quadro = q\.id_quadro and s\.slug = nullif\(v_acao->>''status_destino'', ''''\)\) desc,\s+\(lower\(q\.nome\) like ''agenda%''\) asc, q\.ordem, q\.id_quadro\s+limit 1;',
    E'\n         order by q.ordem limit 1;');
  if v_novo = v_def then raise exception 'rollback v366: trecho não encontrado'; end if;
  execute v_novo;
end $$;

commit;
