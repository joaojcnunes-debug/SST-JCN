-- ============================================================
-- V52 — Conclusão Geral do relatório DRPS (consolidada)
-- ============================================================
-- Complementa `conclusoes_por_setor` (v28) que armazena uma conclusão
-- POR SETOR. A `conclusao_geral` é uma síntese do relatório inteiro,
-- escrita pelo psicólogo ao fim da análise, agregando todos os setores
-- + agravos comuns + medidas de controle do PGR psicossocial.
--
-- Aparece em página própria `/psicossocial/<id>/conclusao-geral` na
-- sidebar do relatório, logo abaixo de "Análise e Avaliação".
--
-- Nullable + sem default — relatórios antigos seguem funcionando.
-- ============================================================

ALTER TABLE public.drps_relatorios
  ADD COLUMN IF NOT EXISTS conclusao_geral TEXT;

COMMENT ON COLUMN public.drps_relatorios.conclusao_geral
  IS 'Conclusão técnica consolidada do relatório DRPS (todos os setores). Renderizada no PDF após o último bloco de análise por setor.';
