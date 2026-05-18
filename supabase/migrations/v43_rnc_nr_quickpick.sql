-- V43 — Vincular RNC a uma NR (opcional) + rastreabilidade do item de origem
--
-- A NR vira CONTEXTO do relatório: quando setada, a UI libera um "quick-pick"
-- de itens do catálogo (lib/conformidade/checklists.ts) pra inserção rápida
-- de NCs com descrição e norma_violada já pré-preenchidas.
--
-- Snapshot: guarda nr_codigo + nr_titulo no header (mesmo padrão do
-- Conformidade NR — catálogo pode evoluir, relatório fica congelado).
--
-- item_codigo_origem nos itens marca quais NCs vieram do checklist (pra
-- evitar duplicar acidentalmente). NCs adicionadas livremente ficam com
-- esse campo NULL.

alter table public.relatorios_nao_conformidade
  add column if not exists nr_codigo text,
  add column if not exists nr_titulo text;

alter table public.relatorios_nao_conformidade_itens
  add column if not exists item_codigo_origem text;

create index if not exists idx_relatorios_nc_nr
  on public.relatorios_nao_conformidade (nr_codigo)
  where nr_codigo is not null;
