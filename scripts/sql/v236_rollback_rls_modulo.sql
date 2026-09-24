-- Rollback da v236 (trava por módulo em modo LOG).
-- Derruba as policies restritivas, as funções, as 3 tabelas e o dblink.
-- Nenhuma policy anterior foi alterada pela v236, então nada a restaurar.
-- O log acumulado se perde — se quiser guardar, exporte rls_modulo_log antes.

begin;

do $$
declare r record; n int := 0;
begin
  for r in select tabela from public.rls_modulo_tabelas loop
    execute format('drop policy if exists rls_modulo on public.%I', r.tabela);
    n := n + 1;
  end loop;
  raise notice 'rollback v236: % policy(ies) restritiva(s) removida(s).', n;
end $$;

drop function if exists public.rls_modulo_resumo();
drop function if exists public.rls_modulo_ok(text, text);
drop table if exists public.rls_modulo_log;
drop table if exists public.rls_modulo_tabelas;
drop table if exists public.rls_modulo_config;
drop extension if exists dblink;
drop schema if exists ext;

delete from public.schema_migrations where version = 'v236_rls_modulo_modo_log';

commit;

notify pgrst, 'reload schema';
