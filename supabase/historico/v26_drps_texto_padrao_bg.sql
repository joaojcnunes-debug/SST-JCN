-- ============================================================
-- v26 — Imagem de fundo nos capitulos do Texto Padrao
-- ============================================================
-- Adiciona url de imagem de fundo para cada capitulo. Quando setada,
-- o capitulo e renderizado como pagina inteira com a imagem cobrindo
-- o fundo (estilo capa) e o conteudo HTML por cima.
-- ============================================================

ALTER TABLE public.drps_texto_padrao
  ADD COLUMN IF NOT EXISTS bg_imagem_url TEXT;

COMMENT ON COLUMN public.drps_texto_padrao.bg_imagem_url
  IS 'URL publica da imagem de fundo (bucket fotos). Capitulo com bg sai como pagina inteira no PDF.';
