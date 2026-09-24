-- ROLLBACK de v198_gestao_form_responsavel_email.sql — GESTAO-KANBAN-01-F1.3-D.
--
-- Remove a coluna aditiva gestao_formularios.responsavel_email. Rollback TRIVIAL:
-- a coluna e puramente aditiva e responsavel_padrao (nome) permaneceu, entao os
-- formularios existentes seguem intactos. Reverter o front = git revert do commit.
--
-- Remove a linha de schema_migrations a mao (migrate.ps1 pula "rollback" no nome —
-- nunca aplica forward). Rodar manual:
--   psql -U chabra_admin -d painel_sst -f v198_gestao_form_responsavel_email.rollback.sql

begin;

alter table public.gestao_formularios drop column if exists responsavel_email;

delete from public.schema_migrations where version = 'v198_gestao_form_responsavel_email';

commit;
