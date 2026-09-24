-- ============================================================================
-- V68: Legenda por foto nos itens da Apreciação NR-12
--
-- foto_legendas é um array de texto PAREADO 1:1 com foto_urls (mesma ordem,
-- mesmo padrão de foto_urls/foto_storage_paths). Legenda vazia = "".
-- Impressa sob cada foto no laudo.
-- ============================================================================

alter table public.apreciacoes_maquinas_itens
  add column if not exists foto_legendas text[] not null default array[]::text[];
