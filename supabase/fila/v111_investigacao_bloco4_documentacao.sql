-- v111 — Investigação de Acidente, Fase 4 (Bloco 4): documentação técnica e medidas
-- (Itens 13, 14, 17). Aditivo/idempotente. `medidas` (existente) = recomendadas.
alter table public.investigacoes_acidente
  add column if not exists laudos_externos jsonb not null default '[]'::jsonb,
  add column if not exists analise_equipe text,
  add column if not exists consultores jsonb not null default '[]'::jsonb,
  add column if not exists analise_links jsonb not null default '[]'::jsonb,
  add column if not exists medidas_adotadas text,
  add column if not exists cronogramas jsonb not null default '[]'::jsonb,
  add column if not exists fotos_pos jsonb not null default '[]'::jsonb,
  add column if not exists responsavel_legal_nome text,
  add column if not exists responsavel_legal_cargo text,
  add column if not exists responsavel_legal_data date;
