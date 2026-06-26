-- V85 — Investigação de Acidente: campos ricos
-- Setores e funções múltiplos, partes do corpo (lista + silhueta) e Ishikawa.

alter table public.investigacoes_acidente
  add column if not exists setores text[] not null default '{}',
  add column if not exists acidentado_funcoes text[] not null default '{}',
  add column if not exists partes_corpo text[] not null default '{}',
  add column if not exists ishikawa jsonb not null default '{}'::jsonb;
