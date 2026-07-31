-- V137 — usuarios: CREA e ART (p/ Responsável Técnico engenheiro no laudo NR-12).
--   crea → registro no CREA (ex.: 2025106994-RJ)
--   art  → ART vinculada (ex.: CREA-RJ nº 2020260174144)
-- Idempotente.

alter table public.usuarios add column if not exists crea text;
alter table public.usuarios add column if not exists art text;
