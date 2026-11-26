-- v372 — comercial_dados leva o Plano de intervenções e o texto dos métodos para o vendedor (26/11/2026, 0.3.328).
--
-- POR QUÊ: pedido do João — "todas as informações da intervenção e do Plano de intervenções devem ir para a tela do
-- comercial, para que o comercial tenha todas as informações para realizar a venda". As tabelas comercial_planos e
-- comercial_metodos (v370) só abrem para quem libera (comercial_pode_liberar); o vendedor lê tudo pela comercial_dados.
--
-- O QUE MUDA: comercial_dados ganha duas chaves, antes de 'grupos':
--   'metodos' — o texto padrão de cada modalidade (catálogo);
--   'planos'  — o plano de cada empresa/grupo. O vendedor só recebe o de quem já foi liberado (atendimento CONCLUIDO, da
--               empresa ou do grupo); quem libera vê todos.
-- TÉCNICA: troca por trecho (pg_get_functiondef + replace); reaplicar não muda (já tem 'planos' → aviso).
-- ENSAIO (26/11/2026): a função mudou, reaplicar deu o mesmo md5, e como Admin vieram 3 métodos, 1 plano e 1 grupo.
-- Rollback: scripts/sql/v372_comercial_dados_planos_rollback.sql (recria o corpo anterior).

begin;

-- Troca por trecho: acrescenta 'metodos' e 'planos' antes de 'grupos' (o trecho tem de aparecer 1 vez; reaplicar não muda).
do $$
declare
  d text := pg_get_functiondef('public.comercial_dados()'::regprocedure);
  de text := E'\n    ''grupos'', coalesce((';
  para text := E'\n    -- v372: o texto dos métodos (catálogo) e o Plano de intervenções de cada empresa/grupo, para o vendedor ver tudo o que a\n'
    || E'    -- equipe preparou. O vendedor só recebe o plano de quem já foi liberado (atendimento concluído); quem libera vê todos.\n'
    || E'    ''metodos'', coalesce((\n'
    || E'      select jsonb_agg(to_jsonb(m) order by m.ordem, m.modalidade) from public.comercial_metodos m\n'
    || E'    ), ''[]''::jsonb),\n'
    || E'    ''planos'', coalesce((\n'
    || E'      select jsonb_agg(to_jsonb(p)) from public.comercial_planos p\n'
    || E'       where v_libera\n'
    || E'          or (p.tipo_alvo = ''empresa'' and exists (select 1 from public.comercial_atendimentos t\n'
    || E'                                                where t.id_empresa = p.id_alvo and t.status = ''CONCLUIDO''))\n'
    || E'          or (p.tipo_alvo = ''grupo'' and exists (select 1 from public.comercial_atendimentos_grupo t\n'
    || E'                                              where t.id_grupo = p.id_alvo and t.status = ''CONCLUIDO''))\n'
    || E'    ), ''[]''::jsonb),\n'
    || E'    ''grupos'', coalesce((';
begin
  if position('''planos'', coalesce((' in d) > 0 then raise notice 'v372: comercial_dados já tem os planos'; return; end if;
  if (length(d) - length(replace(d, de, ''))) / length(de) <> 1 then
    raise exception 'v372: o trecho de ''grupos'' não aparece exatamente 1 vez em comercial_dados — nada foi aplicado';
  end if;
  execute replace(d, de, para);
end $$;

notify pgrst, 'reload schema';
commit;
