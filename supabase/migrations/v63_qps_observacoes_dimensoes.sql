-- v63: adiciona campo de análise qualitativa por dimensão nas aplicações QPS
-- Referência: Fundacentro 2026 / NR-1 — o técnico deve registrar quais
-- condições organizacionais explicam cada dimensão com risco elevado.

ALTER TABLE qps_aplicacoes
  ADD COLUMN IF NOT EXISTS observacoes_dimensoes jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN qps_aplicacoes.observacoes_dimensoes IS
  'Análise qualitativa por dimensão: objeto {id_categoria: texto}. '
  'Registra condições organizacionais observadas que explicam o risco '
  'identificado em cada dimensão. Exigência NR-1 / Fundacentro 2026.';
