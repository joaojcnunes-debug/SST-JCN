-- v131 — Índices de cobertura para as FKs sem índice das tabelas de
-- Gestão Gerencial (gg_*), apontadas pelo advisor de performance
-- (unindexed_foreign_keys). Tabelas pequenas hoje, mas evita seq scans em
-- joins e nos ON DELETE CASCADE das FKs. Idempotente e reversível.

create index if not exists idx_gg_escala_turno    on public.gg_escala_padrao(id_turno);
create index if not exists idx_gg_subs_turno      on public.gg_substituicoes(id_turno);
create index if not exists idx_gg_subs_ausente    on public.gg_substituicoes(id_ausente);
create index if not exists idx_gg_subs_substituto on public.gg_substituicoes(id_substituto);
