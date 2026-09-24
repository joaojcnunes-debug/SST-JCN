-- V34 — Foto opcional por item do checklist de conformidade
--
-- Cada item do relatório pode receber 1 foto que será exibida abaixo do item
-- no detalhe e no PDF impresso. A foto é guardada no bucket `fotos` do
-- Supabase Storage (mesmo bucket usado pelas Inspeções), com path:
--   `conformidade/{id_relatorio}/{id_item}.{ext}`

alter table public.relatorios_conformidade_itens
  add column if not exists foto_url text;

alter table public.relatorios_conformidade_itens
  add column if not exists foto_storage_path text;
