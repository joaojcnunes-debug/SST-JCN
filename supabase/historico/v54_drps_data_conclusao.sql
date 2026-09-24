-- ============================================================
-- V54 — Data de conclusão do relatório DRPS
-- ============================================================
-- Adiciona um timestamp `data_conclusao` setado automaticamente pelo
-- front-end quando o psicólogo marca o relatório como CONCLUIDO (botão
-- "Concluir Análise" em /analise). Diferente de `data_elaboracao`
-- (que é uma data informativa em DATE) — esta é um carimbo automático
-- do MOMENTO em que o diagnóstico foi finalizado.
--
-- Disponível como variável `{{data_conclusao}}` nos capítulos de Texto
-- Padrão pra entrar no PDF.
--
-- Nullable + sem default — relatórios ainda em RASCUNHO/EM_ANDAMENTO
-- ficam com NULL. Se for reaberto (status volta pra outro estado), o
-- carimbo é preservado (não zera) — é o registro da última conclusão.
-- ============================================================

ALTER TABLE public.drps_relatorios
  ADD COLUMN IF NOT EXISTS data_conclusao TIMESTAMPTZ;

COMMENT ON COLUMN public.drps_relatorios.data_conclusao
  IS 'Carimbo automático (TIMESTAMPTZ) do momento em que o relatório foi marcado como CONCLUIDO. Disponível como {{data_conclusao}} nos textos padrão do PDF.';
