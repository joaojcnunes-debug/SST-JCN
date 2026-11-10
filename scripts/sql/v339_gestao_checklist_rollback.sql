-- Rollback da v339 — apaga o checklist da tarefa (os itens marcados se perdem). Use junto com a volta do código.
begin;
drop trigger if exists gestao_checklist_item_trg on public.gestao_checklist_itens;
drop table if exists public.gestao_checklist_itens;
drop function if exists public.gestao_checklist_item_trg();
notify pgrst, 'reload schema';
commit;
