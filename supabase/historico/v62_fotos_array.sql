-- Extintores: single foto → arrays (migra dados existentes)
ALTER TABLE extintores
  ADD COLUMN IF NOT EXISTS fotos_urls TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fotos_storage_paths TEXT[] NOT NULL DEFAULT '{}';

UPDATE extintores
  SET fotos_urls = ARRAY[foto_url],
      fotos_storage_paths = ARRAY[foto_storage_path]
  WHERE foto_url IS NOT NULL;

ALTER TABLE extintores
  DROP COLUMN IF EXISTS foto_url,
  DROP COLUMN IF EXISTS foto_storage_path;

-- EPI/EPC: adiciona arrays de fotos
ALTER TABLE epi_epc
  ADD COLUMN IF NOT EXISTS fotos_urls TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fotos_storage_paths TEXT[] NOT NULL DEFAULT '{}';
