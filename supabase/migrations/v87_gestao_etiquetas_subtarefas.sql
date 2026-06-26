-- V87 — Gestão Chabra: etiquetas e subtarefas nas tarefas
alter table public.gestao_tarefas
  add column if not exists etiquetas text[] not null default '{}',
  add column if not exists subtarefas jsonb not null default '[]'::jsonb;
