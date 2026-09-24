-- ROLLBACK de v196_gestao_vinculo_revoke_dml.sql — GESTAO-KANBAN-01-F1.3-C.
--
-- Restaura a escrita DML direta em gestao_tarefa_vinculados: re-concede INSERT/DELETE a
-- authenticated e recria as policies de escrita da v187 (gestao_tarefa_vinc_ins/_del,
-- gated por gestao_pode_editar_q(quadro-pai)). A escrita direta volta a funcionar — o
-- front antigo (delete-all + reinsert) opera de novo.
--
-- Aplicar ANTES de reverter o front (git revert), que volta ao delete-all+reinsert direto.
-- Remove a linha de schema_migrations. migrate.ps1 pula "rollback" no nome — nunca forward.
-- Rodar manual: psql -U chabra_admin -d painel_sst -f v196_gestao_vinculo_revoke_dml.rollback.sql

begin;

-- (1) Re-concede a escrita direta ao papel do navegador.
grant insert, delete on public.gestao_tarefa_vinculados to authenticated;

-- (2) Recria as policies de escrita da v187 (identicas ao original).
drop policy if exists gestao_tarefa_vinc_ins on public.gestao_tarefa_vinculados;
create policy gestao_tarefa_vinc_ins on public.gestao_tarefa_vinculados
  for insert to authenticated
  with check (public.gestao_pode_editar_q(
    (select t.id_quadro from public.gestao_tarefas t where t.id_tarefa = gestao_tarefa_vinculados.id_tarefa)
  ));

drop policy if exists gestao_tarefa_vinc_del on public.gestao_tarefa_vinculados;
create policy gestao_tarefa_vinc_del on public.gestao_tarefa_vinculados
  for delete to authenticated
  using (public.gestao_pode_editar_q(
    (select t.id_quadro from public.gestao_tarefas t where t.id_tarefa = gestao_tarefa_vinculados.id_tarefa)
  ));

comment on table public.gestao_tarefa_vinculados is
  'Vinculos multiplos por tarefa (responsavel|seguidor por e-mail). Escrita SO por '
  'authenticated com gestao_pode_editar_q(quadro-pai) via RLS (v187, GESTAO-KANBAN-01-F1.2). '
  'gestao_tarefas.responsavel e espelhado do vinculo tipo=responsavel pelo trigger.';

delete from public.schema_migrations where version = 'v196_gestao_vinculo_revoke_dml';

commit;
