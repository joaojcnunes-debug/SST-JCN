-- ROLLBACK da v308 — Inspeções: complexidade. Rodar DEPOIS de voltar o código.
-- Apaga a complexidade marcada nas inspeções.
drop index if exists public.inspecoes_complexidade_idx;
alter table public.inspecoes drop constraint if exists inspecoes_complexidade_check;
alter table public.inspecoes drop column if exists complexidade;
notify pgrst, 'reload schema';
