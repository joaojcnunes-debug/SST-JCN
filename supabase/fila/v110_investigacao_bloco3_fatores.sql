-- v110 — Investigação de Acidente, Fase 3 (Bloco 3): questionário de fatores
-- contribuintes (Item 12). jsonb Record<chave, {resposta, obs}>. Aditivo/idempotente.
alter table public.investigacoes_acidente
  add column if not exists fatores_contribuintes jsonb not null default '{}'::jsonb;
