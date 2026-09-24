-- V48 — Itens livres na Apreciação de Máquinas
--
-- Permite ao auditor ADICIONAR itens à apreciação que não estão no catálogo
-- estático da NR-12 (`lib/apreciacao-maquinas/catalogo-nr12.ts`). Mantém o
-- fluxo principal: ao criar uma apreciação nova, todos os itens do catálogo
-- continuam sendo snapshotados automaticamente (zero impacto).
--
-- Diferenciação:
--   - Snapshot do catálogo:    `item_origem = NULL`        (padrão histórico)
--   - Item livre (manual):     `item_origem = 'LIVRE'`     `item_codigo = 'LIVRE-{N}'`
--
-- Itens livres podem ser EXCLUÍDOS pelo auditor. Snapshot do catálogo não —
-- avaliar como "Não aplicável" é o caminho correto pra itens irrelevantes.
--
-- Backfill desnecessário: linhas existentes ficam com item_origem = NULL,
-- exatamente como deveriam.

alter table public.apreciacoes_maquinas_itens
  add column if not exists item_origem text;

create index if not exists idx_apreciacoes_maquinas_itens_origem
  on public.apreciacoes_maquinas_itens (id_apreciacao, item_origem)
  where item_origem is not null;
