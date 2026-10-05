-- v266 (2026-10-05): AEP ganha o status EM_ANDAMENTO
-- (Rascunho → Em andamento → Concluído), para o dashboard separar o que está
-- sendo feito do que só foi aberto. Já aplicada via MCP.
-- Rollback: scripts/sql/v266_rollback_aep_status_em_andamento.sql
alter table public.aep_relatorios drop constraint if exists aep_relatorios_status_check;
alter table public.aep_relatorios add constraint aep_relatorios_status_check
  check (status = any (array['RASCUNHO'::text, 'EM_ANDAMENTO'::text, 'CONCLUIDO'::text]));
