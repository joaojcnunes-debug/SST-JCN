-- ============================================================
-- ROLLBACK da v148 — estabelecimento de terceiros nas empresas
-- ============================================================
-- NAO E UMA MIGRATION. Vive em scripts/sql/ de proposito e e rodado a mao.
-- (O deploy/migrate.ps1 ignora arquivos com "rollback" no nome desde a
--  confusao da v138 em 2026-07-21, mas a pasta certa continua sendo esta.)
--
-- ⚠️ DESTRUTIVO: apaga os cadastros de terceiros junto com as colunas. Rode o
-- SELECT de conferencia abaixo ANTES e veja quanto se perde.
-- ============================================================

-- Conferencia previa (rode sozinho primeiro):
--   SELECT count(*) FROM public.empresas WHERE tipo_estabelecimento = 'TERCEIROS';
--   SELECT count(*) FROM public.inspecoes i JOIN public.empresas e USING (id_empresa)
--     WHERE e.tipo_estabelecimento = 'TERCEIROS';

BEGIN;

-- Trava: se ja existe inspecao pendurada num terceiro, apagar a coluna
-- transforma o cadastro numa empresa cliente qualquer, em silencio. Melhor
-- abortar e decidir na mao.
DO $$
DECLARE
  n INT;
BEGIN
  SELECT count(*) INTO n FROM public.empresas WHERE tipo_estabelecimento = 'TERCEIROS';
  IF n > 0 THEN
    RAISE EXCEPTION 'rollback v148 abortado: existem % estabelecimento(s) de terceiros cadastrado(s). Trate-os antes.', n;
  END IF;
END $$;

ALTER TABLE public.empresas DROP CONSTRAINT IF EXISTS empresas_tipo_estab_chk;
ALTER TABLE public.empresas DROP CONSTRAINT IF EXISTS empresas_contratante_so_em_terceiros_chk;
ALTER TABLE public.empresas DROP CONSTRAINT IF EXISTS empresas_contratante_nao_e_ela_mesma_chk;

DROP INDEX IF EXISTS public.idx_empresas_contratante;
DROP INDEX IF EXISTS public.idx_empresas_tipo_estab;

ALTER TABLE public.empresas
  DROP COLUMN IF EXISTS tipo_estabelecimento,
  DROP COLUMN IF EXISTS id_empresa_contratante,
  DROP COLUMN IF EXISTS nome_fantasia,
  DROP COLUMN IF EXISTS referencia,
  DROP COLUMN IF EXISTS locais_emergencia,
  DROP COLUMN IF EXISTS dados_adicionais;

COMMIT;

-- Depois de rodar:
--   DELETE FROM public.schema_migrations WHERE version = 'v140_empresa_estabelecimento_terceiros';
--   NOTIFY pgrst, 'reload schema';
