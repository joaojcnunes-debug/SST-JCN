-- Rollback: volta o CHECK aos 4 valores. Falha de proposito se existir linha
-- 'indeterminado' (nao ha para onde converter sem decidir o que houve no SGG).
\set ON_ERROR_STOP on
begin;
alter table public.sgg_envios drop constraint if exists sgg_envios_status_chk;
alter table public.sgg_envios add constraint sgg_envios_status_chk
  check (status in ('pendente','enviado','erro','duplicado'));
delete from public.schema_migrations where version = 'v252_sgg_envios_indeterminado';
commit;
