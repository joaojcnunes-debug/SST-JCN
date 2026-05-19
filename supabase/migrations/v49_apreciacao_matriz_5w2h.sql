-- V49 — Apreciação NR-12 integrada com matriz de risco + 5W2H
--
-- Reaproveita as estruturas já produtizadas no Painel SST em vez de
-- duplicar:
--   - `matrizes_risco` (matriz ativa via `useMatrizAtiva`) calcula nível
--      de risco por item NÃO CONFORME (probabilidade × severidade).
--   - `acoes_5w2h` ganha uma origem opcional `id_apreciacao_item` pra
--      receber ações geradas a partir do checklist da apreciação.
--
-- Ambas as colunas novas são NULLABLE — apreciações já criadas não
-- precisam de backfill, e a integração é opt-in por item.

-- 1) Avaliação de risco no item da apreciação ---------------------------
alter table public.apreciacoes_maquinas_itens
  add column if not exists probabilidade            text,
  add column if not exists severidade               text,
  add column if not exists nivel_risco_calculado    text,
  add column if not exists id_matriz                text references public.matrizes_risco(id_matriz) on delete set null;

-- Index pra agregação "quais itens estão em qual nível dentro do laudo".
-- Útil pra sugestão de risco_residual e listagens filtradas.
create index if not exists idx_apreciacoes_maquinas_itens_nivel
  on public.apreciacoes_maquinas_itens (id_apreciacao, nivel_risco_calculado)
  where nivel_risco_calculado is not null;


-- 2) Origem opcional no 5W2H ------------------------------------------
-- Ação gerada a partir de um item NÃO CONFORME da Apreciação NR-12.
-- Permite navegação bidirecional: do item pra ação (clica e edita prazo/
-- responsável) e da ação pro laudo de origem.
alter table public.acoes_5w2h
  add column if not exists id_apreciacao_item text
    references public.apreciacoes_maquinas_itens(id_item) on delete set null;

create index if not exists idx_acoes_apreciacao_item
  on public.acoes_5w2h (id_apreciacao_item)
  where id_apreciacao_item is not null;
