-- v369 — Comercial/Intervenções: os riscos CONVERGENTES também entram (26/11/2026, 0.3.321).
--
-- POR QUÊ: pedido do João (print da etapa Intervenções): "a tela não está mostrando todos os riscos que foram
-- identificados". Só entravam os itens do fechamento com parecer Confirmar ou AET. Quando o questionário e a AEP
-- CONCORDAM que há risco (classe "Convergente"), a conciliação não pede parecer, e o risco não aparecia — justamente
-- os mais certos. Desde a 0.3.321 a foto do fechamento guarda também esses itens (decisao nula, classe Convergente).
--
-- O QUE FAZ: em `comercial_dados`, as duas listas de itens (empresa e grupo) passam a trazer também os itens sem
-- decisão da classe Convergente, e cada item leva a `classe`. Troca só esses trechos (pg_get_functiondef + replace);
-- para com erro se não achar. REAPLICAR: idempotente. ROLLBACK: scripts/sql/v369_comercial_riscos_convergentes_rollback.sql
begin;

do $$
declare v_def text; v_novo text;
begin
  v_def := pg_get_functiondef('public.comercial_dados'::regproc);
  if position('''classe'', it ->> ''classe''' in v_def) > 0 then
    raise notice 'v369: já aplicada';
    return;
  end if;
  v_novo := replace(v_def, '''decisao'', it ->> ''decisao''', '''decisao'', it ->> ''decisao'', ''classe'', it ->> ''classe''');
  v_novo := replace(v_novo, 'where it ->> ''decisao'' in (''CONFIRMAR'', ''AET'')',
    'where (it ->> ''decisao'' in (''CONFIRMAR'', ''AET'') or (it ->> ''decisao'' is null and it ->> ''classe'' = ''Convergente''))');
  if (length(v_novo) - length(replace(v_novo, 'it ->> ''classe'' = ''Convergente''', ''))) / length('it ->> ''classe'' = ''Convergente''') <> 2 then
    raise exception 'v369: esperava trocar 2 filtros de decisão em comercial_dados (a função mudou?)';
  end if;
  execute v_novo;
end $$;

commit;
