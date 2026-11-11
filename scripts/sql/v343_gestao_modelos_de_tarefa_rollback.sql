-- Desfaz a v343 (Gestão: modelos de tarefa). ATENÇÃO: apaga os campos novos dos modelos (descrição, checklist,
-- prioridade, etiquetas, prazo, "aparece na Nova tarefa"). Os itens (subtarefas) dos modelos ficam.
begin;
alter table public.gestao_subtarefa_modelos
  drop constraint if exists gestao_subtarefa_modelos_checklist_lista,
  drop constraint if exists gestao_subtarefa_modelos_prazo_dias,
  drop constraint if exists gestao_subtarefa_modelos_prioridade,
  drop column if exists descricao,
  drop column if exists checklist,
  drop column if exists prioridade,
  drop column if exists etiquetas,
  drop column if exists prazo_dias,
  drop column if exists prazo_uteis,
  drop column if exists na_criacao;
notify pgrst, 'reload schema';
commit;
