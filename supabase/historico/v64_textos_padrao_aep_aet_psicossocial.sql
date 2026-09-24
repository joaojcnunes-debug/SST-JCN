-- Expande CHECK constraint de textos_padrao.modulo para incluir aep, aet, psicossocial
ALTER TABLE textos_padrao
  DROP CONSTRAINT IF EXISTS textos_padrao_modulo_check;

ALTER TABLE textos_padrao
  ADD CONSTRAINT textos_padrao_modulo_check
  CHECK (modulo IN (
    'sst', 'conformidade', 'nao_conformidade',
    'analise_quimicos', 'apreciacao_maquinas',
    'aep', 'aet', 'psicossocial'
  ));

-- Migra capítulos EDITÁVEIS da AEP para textos_padrao modulo='aep'
-- ordem_global < 2000  → posicao_pdf='inicio' (antes das seções fixas)
-- ordem_global >= 2000 → posicao_pdf='fim'    (após as seções fixas)
INSERT INTO textos_padrao (
  id_capitulo, modulo, ordem, titulo, conteudo,
  bg_imagem_url, caixas_texto, orientacao, quebra_pagina,
  posicao_pdf, ativo, tipo, slug_fixo, created_at
)
SELECT
  id_capitulo::text,
  'aep',
  COALESCE(ordem, 0),
  titulo,
  conteudo,
  bg_imagem_url,
  caixas_texto,
  COALESCE(orientacao, 'retrato'),
  'nova',
  CASE WHEN COALESCE(ordem_global, 0) < 2000 THEN 'inicio' ELSE 'fim' END,
  COALESCE(mostrar, true),
  'editavel',
  slug_fixo,
  NOW()
FROM aep_textos_padrao
WHERE tipo = 'editavel'
ON CONFLICT (id_capitulo) DO NOTHING;

-- Migra capítulos do DRPS para textos_padrao modulo='psicossocial'
-- posicao_pdf já está no formato V53 (inicio/apos_sumario/apos_setores/apos_conclusao/apos_medidas/fim)
INSERT INTO textos_padrao (
  id_capitulo, modulo, ordem, titulo, conteudo,
  bg_imagem_url, caixas_texto, orientacao, quebra_pagina,
  posicao_pdf, ativo, tipo, slug_fixo, created_at
)
SELECT
  id_capitulo,
  'psicossocial',
  COALESCE(ordem, 0),
  titulo,
  conteudo,
  bg_imagem_url,
  caixas_texto,
  COALESCE(orientacao, 'retrato'),
  COALESCE(quebra_pagina, 'nova'),
  COALESCE(posicao_pdf, 'inicio'),
  COALESCE(ativo, true),
  COALESCE(tipo, 'editavel'),
  slug_fixo,
  NOW()
FROM drps_texto_padrao
ON CONFLICT (id_capitulo) DO NOTHING;
