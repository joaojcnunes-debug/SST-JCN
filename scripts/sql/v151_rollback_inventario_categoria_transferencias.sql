-- ROLLBACK da v151 (JCN) — categoria de inventário + tabela transferencias.
--
-- NAO E MIGRATION. Vive em scripts/sql/ de proposito e e rodado a mao.
--
-- ⚠️ DESTRUTIVO: apaga o historico de transferencias e a classificacao dos
-- itens do inventario. Rode a conferencia abaixo ANTES e veja quanto se perde.
--
-- ⚠️ ORDEM: a v152 se apoia nesta. Desfaca a v152 primeiro, senao as colunas e
-- RPCs de transferencia ficam apontando para uma tabela que nao existe mais.
--
-- Conferencia previa (rode sozinho primeiro):
--   SELECT count(*) FROM public.transferencias;
--   SELECT categoria_inventario, count(*) FROM public.inventario_maquinas
--    GROUP BY 1 ORDER BY 1;

BEGIN;

-- Trava: se ja ha transferencia registrada, aborta. Apagar historico de
-- movimentacao de patrimonio nao pode acontecer por descuido — se e mesmo o
-- que se quer, comente este bloco conscientemente.
DO $$
DECLARE n INT;
BEGIN
  SELECT count(*) INTO n FROM public.transferencias;
  IF n > 0 THEN
    RAISE EXCEPTION 'v151 rollback abortado: % transferencia(s) registrada(s) seriam perdidas', n;
  END IF;
END $$;

DROP TABLE IF EXISTS public.transferencias;

DROP INDEX IF EXISTS public.idx_inventario_maquinas_categoria;

ALTER TABLE public.inventario_maquinas
  DROP CONSTRAINT IF EXISTS inventario_maquinas_categoria_inventario_chk;

ALTER TABLE public.inventario_maquinas
  DROP COLUMN IF EXISTS categoria_inventario;

COMMIT;
