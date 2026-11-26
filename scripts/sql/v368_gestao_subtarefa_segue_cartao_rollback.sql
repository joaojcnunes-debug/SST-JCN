-- ROLLBACK v368 — tira o gatilho e os seguidores que ele (ou a carga inicial) pôs (origem 'subtarefa-mae').
begin;
drop trigger if exists gestao_subtarefa_segue_mae on public.gestao_subtarefas;
drop function if exists public.gestao_subtarefa_segue_mae_trg();
select set_config('gestao.sync_sub', 'on', true);
select set_config('gestao.in_google_sync', 'on', true);
delete from public.gestao_tarefa_vinculados where tipo = 'seguidor' and origem = 'subtarefa-mae';
select set_config('gestao.sync_sub', '', true);
select set_config('gestao.in_google_sync', '', true);
commit;
