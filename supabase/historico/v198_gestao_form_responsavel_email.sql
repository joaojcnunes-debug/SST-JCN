-- v198 — GESTAO-KANBAN-01-F1.3-D: formulario grava responsavel por E-MAIL.
--
-- Adiciona gestao_formularios.responsavel_email (o e-mail do responsavel padrao do
-- form). O submit da rota Next (app/api/gestao/form/route.ts) resolve esse e-mail em
-- usuarios ativo e, quando resolve, cria a tarefa com created_by=<e-mail> e insere o
-- vinculo (gestao_tarefa_vinculados tipo=responsavel) via service_role -> o trigger
-- v187 espelha gestao_tarefas.responsavel = usuarios.nome. Assim a tarefa de formulario
-- deixa de nascer orfa (invisivel ao responsavel comum sob a F1.3-B).
--
-- Puramente ADITIVA e idempotente: `add column if not exists`, aplica 2x com exit 0.
-- MANTEM responsavel_padrao (nome) para nao quebrar formularios existentes (legado/exibicao).
-- Sem policy nova (a coluna herda gestao_formularios_wr/_sel), sem grant novo.
-- begin;...commit; PROPRIO — NAO aplicar com psql -1.
-- schema_migrations e inserido pelo operador no apply (padrao v196/v197 — migrate.ps1);
-- o rollback (scripts/sql/v198_gestao_form_responsavel_email.rollback.sql) remove a linha.

begin;

-- Guarda — falha fechada em vez de aplicar as cegas (padrao v187/v197).
do $$
begin
  if to_regclass('public.gestao_formularios') is null then
    raise exception 'v198: public.gestao_formularios nao existe — abortado';
  end if;
end $$;

alter table public.gestao_formularios add column if not exists responsavel_email text;

comment on column public.gestao_formularios.responsavel_email is
  'E-mail do responsavel padrao do formulario (F1.3-D). O submit resolve em usuarios '
  'ativo e cria vinculo tipo=responsavel + created_by=<e-mail>; o trigger v187 espelha '
  'gestao_tarefas.responsavel=nome. responsavel_padrao (nome) permanece como legado.';

commit;
