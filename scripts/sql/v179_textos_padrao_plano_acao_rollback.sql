-- ROLLBACK da V179 — remove "plano_acao" do discriminador de `textos_padrao`.
--
-- ⚠️ Só roda se NÃO houver capítulo cadastrado no módulo plano_acao. Confira
-- antes, senão o ADD CONSTRAINT falha (e falhar é o certo — apagar capítulo
-- que alguém escreveu seria pior):
--
--   SELECT count(*) FROM textos_padrao WHERE modulo = 'plano_acao';
--
-- Se vier > 0, decida com o Sanmyo o que fazer com essas linhas ANTES.

ALTER TABLE textos_padrao
  DROP CONSTRAINT IF EXISTS textos_padrao_modulo_check;

ALTER TABLE textos_padrao
  ADD CONSTRAINT textos_padrao_modulo_check
  CHECK (modulo IN (
    'sst', 'conformidade', 'nao_conformidade',
    'analise_quimicos', 'apreciacao_maquinas',
    'aep', 'aet', 'psicossocial'
  ));

DELETE FROM public.schema_migrations WHERE version = 'v179_textos_padrao_plano_acao';
