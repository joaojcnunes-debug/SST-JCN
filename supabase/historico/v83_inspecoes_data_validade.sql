-- v83: Validade do documento na inspeção (Painel SST / PGR).
-- A inspeção também é um documento com vencimento. Aplicada via MCP. Aditiva/idempotente.

alter table public.inspecoes add column if not exists data_validade date;
