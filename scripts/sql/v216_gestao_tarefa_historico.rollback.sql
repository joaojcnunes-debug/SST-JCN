-- Rollback de v216_gestao_tarefa_historico.sql — G1.1 (trilha de movimentações da tarefa).
-- A tabela é nova e isolada; o drop não afeta nada existente.
-- Nome com "rollback" → migrate.ps1 NÃO aplica isto no fluxo normal (é manual, gateado).

drop trigger if exists gestao_tarefa_historico_trg on public.gestao_tarefas;

drop function if exists public.gestao_tarefa_historico_trg();

drop table if exists public.gestao_tarefa_historico;

delete from schema_migrations where version like 'v216%';
