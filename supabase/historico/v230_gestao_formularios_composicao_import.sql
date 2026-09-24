-- v230 — GESTAO-KANBAN-03 F1.5: formulários com título composto + identidade de import.
--
-- O que muda em public.gestao_formularios (tudo aditivo, nullable, idempotente):
--   • titulo_composicao jsonb — como montar o título da tarefa a partir das respostas, no
--     modelo do Runrun (`task_title_composition_pattern`): array de tokens "form_title" |
--     "p:<id da pergunta>". NULL = o respondente digita o título (comportamento de hoje).
--   • runrun_form_id bigint UNIQUE (índice) — chave de idempotência do importador de
--     formulários (scripts/importar-runrun-forms.ts). NULL nos forms criados no app.
--   • origem jsonb — snapshot cru do form do Runrun (board/etapa/tipo/flags), só informativo.
--
-- As perguntas (jsonb `perguntas[]`) ganham chaves novas SEM DDL: `id` (estável), `ajuda`,
-- `condicao {pergunta:<id>, opcao}` (pergunta condicional) e `pendente_anexo` (era `documents`
-- no Runrun; upload público fica para a F2). O front e a rota /api/gestao/form leem as chaves
-- novas com fallback — formulários antigos seguem válidos.
--
-- Coluna nova → o PostgREST precisa de reload do schema-cache (NOTIFY pgrst / restart).
-- Grants/RLS: inalterados (colunas herdam os da tabela). Rollback: drop das 3 colunas.

begin;

alter table public.gestao_formularios
  add column if not exists titulo_composicao jsonb,
  add column if not exists runrun_form_id bigint,
  add column if not exists origem jsonb;

create unique index if not exists uq_gestao_formularios_runrun_form_id
  on public.gestao_formularios (runrun_form_id) where runrun_form_id is not null;

commit;
