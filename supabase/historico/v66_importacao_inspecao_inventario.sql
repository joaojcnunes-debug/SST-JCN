-- ============================================================================
-- V66: Importação de máquinas de Inspeções para o Inventário NR-12
--
-- Máquinas registradas na aba "Máquinas/NR-12" de uma inspeção
-- (tabela inspecao_maquinas) podem ser importadas pro inventário central
-- (inventario_maquinas), ficando disponíveis pra Apreciação NR-12.
--
-- Colunas de origem permitem rastrear e deduplicar a importação:
--   - id_inspecao         → inspeção de onde a máquina veio
--   - id_maquina_inspecao → registro original em inspecao_maquinas
--
-- apreciacoes_maquinas.id_inspecao registra a inspeção de origem quando a
-- apreciação é criada a partir de uma máquina importada.
-- ============================================================================

alter table public.inventario_maquinas
  add column if not exists id_inspecao text null,
  add column if not exists id_maquina_inspecao uuid null;

create index if not exists idx_inventario_maquinas_origem_inspecao
  on public.inventario_maquinas (id_maquina_inspecao)
  where id_maquina_inspecao is not null;

alter table public.apreciacoes_maquinas
  add column if not exists id_inspecao text null;
