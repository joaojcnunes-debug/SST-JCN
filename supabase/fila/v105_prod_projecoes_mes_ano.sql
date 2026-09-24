-- v105 — Projeções salvas: guarda o mês/ano de referência (rastreabilidade). Aditivo/nullable.
alter table public.prod_projecoes_salvas add column if not exists mes smallint;
alter table public.prod_projecoes_salvas add column if not exists ano smallint;
