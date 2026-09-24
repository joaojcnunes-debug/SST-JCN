-- Rollback de v218_presenca_pings.sql — presença no painel.
-- A tabela é nova e isolada; o drop não afeta nada existente. O navegador que
-- ainda chamar presenca_ping() recebe 404 do PostgREST e engole em silêncio
-- (usePresencaPing nunca lança).
-- Nome com "rollback" → migrate.ps1 NÃO aplica isto no fluxo normal (é manual, gateado).

drop function if exists public.presenca_limpar(integer);
drop function if exists public.presenca_resumo(date);
drop function if exists public.presenca_ping(text);

drop table if exists public.presenca_pings;

delete from schema_migrations where version like 'v218%';

notify pgrst, 'reload schema';
