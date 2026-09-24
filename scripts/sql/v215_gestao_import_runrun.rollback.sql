-- Rollback de v215_gestao_import_runrun.sql — F4 (infra do import Runrun.it).
-- Nome com "rollback" -> migrate.ps1 NAO aplica isto no fluxo normal (rodado a mao).
-- Reverte tudo: dropa a tabela de log, o indice unico e as duas colunas da tarefa.
-- ATENCAO: dropar runrun_id/origem apaga a identidade externa dos cartoes ja importados
-- (se o import tiver rodado). Como rollback de schema, e o comportamento esperado.

drop table if exists public.gestao_import_log;

drop index if exists public.gestao_tarefas_runrun_id_uq;

alter table public.gestao_tarefas drop column if exists origem;
alter table public.gestao_tarefas drop column if exists runrun_id;

delete from schema_migrations where version = 'v215_gestao_import_runrun';
