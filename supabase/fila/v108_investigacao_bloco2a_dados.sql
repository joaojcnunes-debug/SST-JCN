-- v108 — Investigação de Acidente, Fase 2a (Bloco 2 — dados): pessoas envolvidas /
-- organograma, organização do trabalho, atividade no momento e relatos dos
-- envolvidos (Itens 8-11). Aditivo/idempotente. (Mídia vem na Fase 2b.)
alter table public.investigacoes_acidente
  add column if not exists pessoas_envolvidas jsonb not null default '[]'::jsonb,
  add column if not exists organizacao_trabalho jsonb not null default '{}'::jsonb,
  add column if not exists atividade_momento text,
  add column if not exists relatos_envolvidos jsonb not null default '[]'::jsonb;
