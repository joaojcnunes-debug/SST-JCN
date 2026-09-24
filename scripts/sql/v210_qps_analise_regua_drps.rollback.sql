-- Rollback da v210 (tela Análise do QPS). Apaga o que o psicólogo tiver
-- digitado nas 4 colunas — rode só se a tela for retirada do ar.
BEGIN;
ALTER TABLE public.qps_aplicacoes
  DROP COLUMN IF EXISTS agravos_por_setor,
  DROP COLUMN IF EXISTS medidas_por_setor,
  DROP COLUMN IF EXISTS conclusoes_por_setor;
ALTER TABLE public.qps_categorias DROP COLUMN IF EXISTS fonte_geradora;
DELETE FROM public.schema_migrations WHERE version = 'v210_qps_analise_regua_drps';
COMMIT;
NOTIFY pgrst, 'reload schema';
