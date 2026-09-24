-- ============================================================
-- v27 — Caixas de texto posicionaveis (capa) no Texto Padrao
-- ============================================================
-- Cada capitulo com imagem de fundo pode ter N caixas de texto
-- posicionadas livremente. Cada caixa: id, x%, y%, w%, fontSize, align,
-- bold, color, conteudo (texto com variaveis {{xxx}}).
-- Armazenamos como JSONB para simplicidade (sem tabela filha).
-- ============================================================

ALTER TABLE public.drps_texto_padrao
  ADD COLUMN IF NOT EXISTS caixas_texto JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.drps_texto_padrao.caixas_texto
  IS 'Array JSONB de caixas de texto posicionadas sobre a imagem de fundo da capa. Schema: [{id, x, y, w, fontSize, align, bold, color, conteudo}].';
