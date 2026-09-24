-- Rollback da v230: remove as 3 colunas aditivas de gestao_formularios.
-- Perde titulo_composicao/runrun_form_id/origem dos formulários importados (o import é
-- reexecutável a partir do JSON). Depois: reload do PostgREST. NÃO mexe em schema_migrations.
begin;
drop index if exists public.uq_gestao_formularios_runrun_form_id;
alter table public.gestao_formularios
  drop column if exists titulo_composicao,
  drop column if exists runrun_form_id,
  drop column if exists origem;
commit;
