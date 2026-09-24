-- v147 — Apreciação NR-12: item da norma por linha de perigo.
--
-- CONTEXTO: a ficha por máquina (seção 4 do laudo de referência) tem a coluna
-- "Item NR-12", que aponta o(s) item(ns) da norma relacionados àquele perigo —
-- ex.: "12.38 a 12.55", "12.46". O comentário da v146 afirmava que o painel já
-- coletava esse dado; ISSO ESTAVA ERRADO. A tabela tem `npe_item`, que é o
-- Número de Pessoas Expostas (vocabulário ACIMA_50 / DE_16_50 / ...), coisa
-- diferente. Sem esta coluna a ficha sai com a coluna vazia.
--
-- SEGURANÇA DO DADO:
--   * `apreciacao_riscos_hrn` seguia com ZERO linhas no sistema inteiro quando
--     esta migration foi escrita (conferido em 2026-07-31) — nada a converter.
--   * Coluna nullable, sem default e sem backfill: nenhuma linha é alterada.
--   * `npe_item` NÃO é tocada — continua sendo o NPE.
--   * RLS não muda (a coluna herda as policies da tabela).
--
-- Texto livre de propósito: no laudo o campo aparece como faixa ("12.38 a
-- 12.55") e como item solto ("12.46"), às vezes vários por linha. Uma FK para
-- um catálogo de itens não representaria isso sem inventar regra que o RT não
-- pediu.
--
-- Aditiva e idempotente. Rodar com `psql -1` para ter transação única.

alter table public.apreciacao_riscos_hrn
  add column if not exists item_nr12 text;

comment on column public.apreciacao_riscos_hrn.item_nr12 is
  'Item(ns) da NR-12 relacionados ao perigo, texto livre — ex.: "12.38 a 12.55", "12.46". Sai na coluna "Item NR-12" da ficha. NÃO confundir com `npe_item`, que é o Número de Pessoas Expostas.';
