-- V139 — inspecao_maquinas: operadores/responsáveis da máquina (lista {nome, cargo}).
-- Levados à apreciação (fichas) no auto-import. Idempotente.

alter table public.inspecao_maquinas add column if not exists operadores jsonb;
