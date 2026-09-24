-- ROLLBACK da v255 — tira a regra "tabela nova liga sozinha" e desliga as 6.
--
-- A trilha já gravada dessas tabelas FICA em `auditoria_eventos` (apagar
-- registro é decisão do operador). As `prod_*` continuam `ativo = false`: elas
-- não existem mais, voltar para true seria mentir na config.
-- Tabelas que a regra ligou DEPOIS da v255 continuam com gatilho — para ver
-- quais: select tabela, criado_em from auditoria_tabelas order by criado_em desc;
-- Rodar com `psql -1 -v ON_ERROR_STOP=1` como chabra_admin.

drop event trigger if exists auditoria_tabela_nova;
drop function if exists public.auditoria_ligar_tabela_nova();
drop function if exists public.auditoria_elegivel(text);

do $$
declare t text;
begin
  foreach t in array array['funcoes_painel','cargos_painel','rls_modulo_config',
                           'rls_modulo_tabelas','gestao_equipes','gestao_equipe_membros']
  loop
    if to_regclass('public.' || quote_ident(t)) is not null then
      perform public.auditoria_desativar(t);
    end if;
  end loop;
end $$;

delete from public.schema_migrations
 where version = 'v255_auditoria_tabela_nova_liga_sozinha';

notify pgrst, 'reload schema';
