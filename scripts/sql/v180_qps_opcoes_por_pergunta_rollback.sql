-- ROLLBACK da v180 — QPS: alternativas próprias por pergunta.
--
-- ⚠️ APAGA DADO: as alternativas cadastradas em qps_perguntas.opcoes somem, e
-- as respostas já importadas contra elas viram números soltos, lidos de novo
-- pela escala do tipo. Só rode se a v180 tiver acabado de subir e ninguém
-- tiver cadastrado alternativa nenhuma.
--
-- Confira antes:
--   SELECT count(*) FROM qps_perguntas WHERE opcoes IS NOT NULL;

ALTER TABLE qps_perguntas
  DROP CONSTRAINT IF EXISTS qps_perguntas_opcoes_check;

ALTER TABLE qps_perguntas
  DROP COLUMN IF EXISTS opcoes;
