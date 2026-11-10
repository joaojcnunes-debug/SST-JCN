-- Rollback da v338 — Gestão: empresa na tarefa (0.3.264).
-- ATENÇÃO: apaga as ligações tarefa → empresa (coluna id_empresa). Use junto com a volta do código
-- (a janela da tarefa, o cartão, a Agenda e a ficha da empresa leem a coluna e as funções).
begin;
drop trigger if exists gestao_tarefa_empresa on public.gestao_tarefas;
drop function if exists public.gestao_tarefa_empresa_trg();
drop function if exists public.gestao_empresa_sugerida(text);
drop function if exists public.gestao_tarefas_da_empresa(text);
drop function if exists public.gestao_empresa_nomes_atualizar(boolean);
drop materialized view if exists public.gestao_empresa_nomes;
drop function if exists public.gestao_norm_nome(text, boolean);
drop index if exists public.idx_gestao_tarefas_empresa;
alter table public.gestao_tarefas drop constraint if exists gestao_tarefas_id_empresa_fkey;
alter table public.gestao_tarefas drop column if exists id_empresa;
notify pgrst, 'reload schema';
commit;
