-- ============================================================
-- v28 — Campo de Conclusao por setor no relatorio DRPS
-- ============================================================
-- Cada bloco de setor no relatorio formal de Analise e Avaliacao
-- ganha um texto de "Conclusao" editavel pelo psicologo. Salvamos
-- como JSONB no proprio drps_relatorios: { "<setor>": "<texto>" }.
-- ============================================================

ALTER TABLE public.drps_relatorios
  ADD COLUMN IF NOT EXISTS conclusoes_por_setor JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.drps_relatorios.conclusoes_por_setor
  IS 'Mapa { "<setor>": "<texto>" } com a conclusao manuscrita pelo psicologo para cada setor.';
