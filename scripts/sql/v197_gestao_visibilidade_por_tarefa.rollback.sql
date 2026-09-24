-- ROLLBACK de v197_gestao_visibilidade_por_tarefa.sql — GESTAO-KANBAN-01-F1.3-B.
--
-- Restaura a visibilidade POR QUADRO (o estado pre-flip): as 7 policies de SELECT
-- voltam a gestao_pode_ver(...) PURO (expressoes capturadas verbatim da producao em
-- 2026-09-02), remove a policy nova de comentario (gestao_coment_ins_comment) e a
-- funcao public.gestao_ve_tarefa. O write (gestao_*_wr / gestao_*_ins) nunca foi tocado.
--
-- Volta INSTANTANEA ao "por quadro". Esta e a rede de seguranca da JANELA SEM USUARIOS:
-- se o detector C10 reprovar apos o apply, rodar este rollback na hora.
--
-- Remove a linha de schema_migrations na mesma tx. migrate.ps1 pula "rollback" no nome —
-- nunca e aplicado como forward. Rodar manual:
--   psql -U chabra_admin -d painel_sst -f v197_gestao_visibilidade_por_tarefa.rollback.sql

begin;

-- (1) SELECT de gestao_tarefas volta a por-quadro puro.
drop policy if exists gestao_tarefas_sel on public.gestao_tarefas;
create policy gestao_tarefas_sel on public.gestao_tarefas
  for select to authenticated
  using (gestao_pode_ver(id_quadro));

-- (2) Os 6 satelites voltam a por-quadro puro (subquery ao id_quadro da tarefa-pai).
drop policy if exists gestao_anexos_sel on public.gestao_anexos;
create policy gestao_anexos_sel on public.gestao_anexos
  for select to authenticated
  using (gestao_pode_ver(( SELECT t.id_quadro
     FROM gestao_tarefas t
    WHERE (t.id_tarefa = gestao_anexos.id_tarefa))));

drop policy if exists gestao_ativ_sel on public.gestao_atividades;
create policy gestao_ativ_sel on public.gestao_atividades
  for select to authenticated
  using (gestao_pode_ver(( SELECT t.id_quadro
     FROM gestao_tarefas t
    WHERE (t.id_tarefa = gestao_atividades.id_tarefa))));

drop policy if exists gestao_coment_sel on public.gestao_comentarios;
create policy gestao_coment_sel on public.gestao_comentarios
  for select to authenticated
  using (gestao_pode_ver(( SELECT t.id_quadro
     FROM gestao_tarefas t
    WHERE (t.id_tarefa = gestao_comentarios.id_tarefa))));

drop policy if exists gestao_dep_sel on public.gestao_dependencias;
create policy gestao_dep_sel on public.gestao_dependencias
  for select to authenticated
  using (gestao_pode_ver(( SELECT t.id_quadro
     FROM gestao_tarefas t
    WHERE (t.id_tarefa = gestao_dependencias.id_tarefa))));

drop policy if exists gestao_tempo_sel on public.gestao_tempo;
create policy gestao_tempo_sel on public.gestao_tempo
  for select to authenticated
  using (gestao_pode_ver(( SELECT t.id_quadro
     FROM gestao_tarefas t
    WHERE (t.id_tarefa = gestao_tempo.id_tarefa))));

drop policy if exists gestao_tarefa_vinc_sel on public.gestao_tarefa_vinculados;
create policy gestao_tarefa_vinc_sel on public.gestao_tarefa_vinculados
  for select to authenticated
  using (gestao_pode_ver(( SELECT t.id_quadro
     FROM gestao_tarefas t
    WHERE (t.id_tarefa = gestao_tarefa_vinculados.id_tarefa))));

-- (2b) As 5 policies _wr FOR ALL voltam ao USING original (por-quadro puro, sem
--      gestao_ve_tarefa). WITH CHECK original preservado (nunca mudou). Expressoes
--      capturadas verbatim da producao em 2026-09-02.
drop policy if exists gestao_tarefas_wr on public.gestao_tarefas;
create policy gestao_tarefas_wr on public.gestao_tarefas
  for all to authenticated
  using (gestao_pode_editar_q(id_quadro))
  with check (gestao_pode_editar_q(id_quadro));

drop policy if exists gestao_anexos_wr on public.gestao_anexos;
create policy gestao_anexos_wr on public.gestao_anexos
  for all to authenticated
  using (gestao_pode_editar_q(( SELECT t.id_quadro
     FROM gestao_tarefas t
    WHERE (t.id_tarefa = gestao_anexos.id_tarefa))))
  with check (gestao_pode_editar_q(( SELECT t.id_quadro
     FROM gestao_tarefas t
    WHERE (t.id_tarefa = gestao_anexos.id_tarefa))));

drop policy if exists gestao_coment_wr on public.gestao_comentarios;
create policy gestao_coment_wr on public.gestao_comentarios
  for all to authenticated
  using (gestao_pode_editar_q(( SELECT t.id_quadro
     FROM gestao_tarefas t
    WHERE (t.id_tarefa = gestao_comentarios.id_tarefa))))
  with check (gestao_pode_editar_q(( SELECT t.id_quadro
     FROM gestao_tarefas t
    WHERE (t.id_tarefa = gestao_comentarios.id_tarefa))));

drop policy if exists gestao_dep_wr on public.gestao_dependencias;
create policy gestao_dep_wr on public.gestao_dependencias
  for all to authenticated
  using (gestao_pode_editar_q(( SELECT t.id_quadro
     FROM gestao_tarefas t
    WHERE (t.id_tarefa = gestao_dependencias.id_tarefa))))
  with check (gestao_pode_editar_q(( SELECT t.id_quadro
     FROM gestao_tarefas t
    WHERE (t.id_tarefa = gestao_dependencias.id_tarefa))));

drop policy if exists gestao_tempo_wr on public.gestao_tempo;
create policy gestao_tempo_wr on public.gestao_tempo
  for all to authenticated
  using (gestao_pode_editar_q(( SELECT t.id_quadro
     FROM gestao_tarefas t
    WHERE (t.id_tarefa = gestao_tempo.id_tarefa))))
  with check (gestao_pode_editar_q(( SELECT t.id_quadro
     FROM gestao_tarefas t
    WHERE (t.id_tarefa = gestao_tempo.id_tarefa))));

-- (3) Remove a policy nova de comentario para nivel 'comment' (comentar volta a exigir
--     edit, via gestao_coment_wr, como era antes de B).
drop policy if exists gestao_coment_ins_comment on public.gestao_comentarios;

-- (4) Remove a funcao do flip. Nenhuma policy a referencia mais (as 7 foram repostas acima).
drop function if exists public.gestao_ve_tarefa(text);

-- (5) Tira a marca da migration.
delete from public.schema_migrations where version = 'v197_gestao_visibilidade_por_tarefa';

commit;
