-- ============================================================
-- v29 — Agravos e Medidas por setor no relatorio DRPS
-- ============================================================
-- Antes: drps_relatorios.agravos_saude_mental e medidas_existentes eram
-- texto unico no relatorio. Agora cada setor tem o proprio conjunto.
-- Armazenamos como JSONB { "<setor>": "<texto em bullets>" }.
-- Os campos antigos ficam por compatibilidade com dados ja gravados.
-- ============================================================

ALTER TABLE public.drps_relatorios
  ADD COLUMN IF NOT EXISTS agravos_por_setor JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS medidas_por_setor JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.drps_relatorios.agravos_por_setor
  IS 'Mapa { "<setor>": "<texto>" } com os agravos a saude mental aplicaveis a cada setor.';
COMMENT ON COLUMN public.drps_relatorios.medidas_por_setor
  IS 'Mapa { "<setor>": "<texto>" } com as medidas de controle existentes em cada setor.';
