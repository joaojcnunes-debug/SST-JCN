-- Rollback de v209_gestao_google.sql — F3.A (Google Agenda outbound).
-- As 3 tabelas são novas e isoladas; o drop não afeta nada existente.
-- Nome com "rollback" → migrate.ps1 NÃO aplica isto no fluxo normal (é manual, gateado).

drop trigger if exists gestao_google_tarefas_trg    on public.gestao_tarefas;
drop trigger if exists gestao_google_vinculados_trg on public.gestao_tarefa_vinculados;

drop function if exists public.gestao_google_enfileirar_trg();
drop function if exists public.gestao_google_salvar_conta(text, text, text);
drop function if exists public.gestao_google_ler_token(text, text);
drop function if exists public.gestao_google_status(text);

drop table if exists public.gestao_google_fila;
drop table if exists public.gestao_google_eventos;
drop table if exists public.gestao_google_contas;

delete from schema_migrations where version like 'v209%';
