-- v109 — Investigação de Acidente, Fase 2b (Bloco 2 — mídia): croqui/planta, mapa
-- de riscos, fotos categorizadas (anteriores/momento/atuais) e vídeos (links) — Item 7.
-- Fotos = jsonb [{url,path}] (bucket "fotos"); vídeos = jsonb [{url,descricao}].
-- Aditivo/idempotente.
alter table public.investigacoes_acidente
  add column if not exists croqui jsonb not null default '[]'::jsonb,
  add column if not exists mapa_riscos jsonb not null default '[]'::jsonb,
  add column if not exists fotos_anteriores jsonb not null default '[]'::jsonb,
  add column if not exists fotos_momento jsonb not null default '[]'::jsonb,
  add column if not exists fotos_atuais jsonb not null default '[]'::jsonb,
  add column if not exists videos jsonb not null default '[]'::jsonb;
