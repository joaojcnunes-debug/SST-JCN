-- V35 — Múltiplas fotos por item do checklist de conformidade
--
-- Substitui `foto_url`/`foto_storage_path` (1 foto) por arrays
-- `foto_urls`/`foto_storage_paths` (várias fotos por item).
--
-- As colunas antigas NÃO são removidas — ficam zeradas após o backfill,
-- evitando quebra caso uma versão antiga do frontend ainda esteja servindo.

-- 1) Cria as colunas array (idempotente)
alter table public.relatorios_conformidade_itens
  add column if not exists foto_urls text[] not null default array[]::text[];

alter table public.relatorios_conformidade_itens
  add column if not exists foto_storage_paths text[] not null default array[]::text[];

-- 2) Backfill: traz a foto antiga (singular) pro novo array, se houver
update public.relatorios_conformidade_itens
  set foto_urls = array[foto_url]
  where foto_url is not null
    and (foto_urls is null or cardinality(foto_urls) = 0);

update public.relatorios_conformidade_itens
  set foto_storage_paths = array[foto_storage_path]
  where foto_storage_path is not null
    and (foto_storage_paths is null or cardinality(foto_storage_paths) = 0);

-- 3) Garantia: arrays nunca podem ser NULL (devem ser arrays vazios)
update public.relatorios_conformidade_itens
  set foto_urls = array[]::text[]
  where foto_urls is null;

update public.relatorios_conformidade_itens
  set foto_storage_paths = array[]::text[]
  where foto_storage_paths is null;
