-- v159 ROLLBACK — solta a trava de coerência entre situação e não conformidades
-- dos extintores.
--
-- A v159 não tocou em dado nenhum: só criou a constraint. Desfazer é derrubá-la.
-- Nada é perdido; volta a ser possível gravar "não conforme sem causa" e
-- "conforme com causa", que é o estado de antes.
--
-- Rodar com:
--   docker exec -i db-messages-postgres psql -U chabra_admin -d painel_sst \
--     -v ON_ERROR_STOP=1 -f - < v159_extintores_coerencia_check_rollback.sql
--
-- Não exige deploy nem reload do PostgREST: constraint não muda o schema que
-- ele anuncia.

begin;

alter table public.extintores
  drop constraint if exists extintores_coerencia_check;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'extintores_coerencia_check') then
    raise exception 'rollback v159 falhou: a constraint ainda existe';
  end if;
  raise notice 'rollback v159 OK: trava removida';
end $$;

commit;
