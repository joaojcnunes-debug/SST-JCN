-- ROLLBACK v369 — comercial_dados volta a devolver só os itens com Confirmar/AET, sem a classe.
begin;

do $$
declare v_def text; v_novo text;
begin
  v_def := pg_get_functiondef('public.comercial_dados'::regproc);
  if position('''classe'', it ->> ''classe''' in v_def) = 0 then
    raise notice 'rollback v369: não estava aplicada';
    return;
  end if;
  v_novo := replace(v_def, '''decisao'', it ->> ''decisao'', ''classe'', it ->> ''classe''', '''decisao'', it ->> ''decisao''');
  v_novo := replace(v_novo,
    'where (it ->> ''decisao'' in (''CONFIRMAR'', ''AET'') or (it ->> ''decisao'' is null and it ->> ''classe'' = ''Convergente''))',
    'where it ->> ''decisao'' in (''CONFIRMAR'', ''AET'')');
  execute v_novo;
end $$;

commit;
