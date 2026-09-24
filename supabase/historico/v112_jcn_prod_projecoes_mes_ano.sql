-- v112 (JCN) — Projeções salvas: guarda o mês/ano de referência (rastreabilidade). Aditivo/nullable.
-- Reflexo do painel-sst v105_prod_projecoes_mes_ano. Aplicado via MCP supabase-sst.
alter table public.prod_projecoes_salvas add column if not exists mes smallint;
alter table public.prod_projecoes_salvas add column if not exists ano smallint;
