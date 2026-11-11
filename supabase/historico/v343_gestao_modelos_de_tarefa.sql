-- v343 — Gestão: modelos de tarefa (11/11/2026, 0.3.272).
--
-- Trazida da v354 do Painel (0.3.923), item 13. O item 11 da mesma v354 (empresa na tarefa) já entrou como v338.
-- gestao_subtarefa_modelos ganha descrição, checklist, prioridade, etiquetas, prazo (dias corridos ou úteis) e
-- "aparece na Nova tarefa" (na_criacao). Modelos que já existem ficam fora da Nova tarefa até alguém marcar.
-- A automação criar_subtarefas_modelo continua igual (só as subtarefas).
--
-- REAPLICAR: idempotente. ROLLBACK: scripts/sql/v343_gestao_modelos_de_tarefa_rollback.sql

begin;

do $$ begin
  if to_regclass('public.gestao_subtarefa_modelos') is null then
    raise exception 'v343: falta gestao_subtarefa_modelos';
  end if;
end $$;

alter table public.gestao_subtarefa_modelos
  add column if not exists descricao text,
  add column if not exists checklist jsonb not null default '[]'::jsonb,
  add column if not exists prioridade text,
  add column if not exists etiquetas text[] not null default '{}'::text[],
  add column if not exists prazo_dias int,
  add column if not exists prazo_uteis boolean not null default false,
  add column if not exists na_criacao boolean not null default false;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'gestao_subtarefa_modelos_checklist_lista') then
    alter table public.gestao_subtarefa_modelos add constraint gestao_subtarefa_modelos_checklist_lista check (jsonb_typeof(checklist) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'gestao_subtarefa_modelos_prazo_dias') then
    alter table public.gestao_subtarefa_modelos add constraint gestao_subtarefa_modelos_prazo_dias check (prazo_dias is null or prazo_dias between 0 and 365);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'gestao_subtarefa_modelos_prioridade') then
    alter table public.gestao_subtarefa_modelos add constraint gestao_subtarefa_modelos_prioridade check (prioridade is null or prioridade in ('Urgente', 'Alta', 'Media', 'Baixa'));
  end if;
end $$;
comment on column public.gestao_subtarefa_modelos.na_criacao is 'v343 (= v354 do Painel): aparece em "Usar modelo" na Nova tarefa.';
comment on column public.gestao_subtarefa_modelos.checklist is 'v343 (= v354 do Painel): itens do checklist (lista de textos) que o modelo põe na Nova tarefa.';

notify pgrst, 'reload schema';

commit;
