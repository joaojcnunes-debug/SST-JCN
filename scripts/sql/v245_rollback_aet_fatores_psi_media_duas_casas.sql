-- ROLLBACK da v245 — devolve aet_laudo_fatores_psi.media a numeric(3,1).
--
-- ⚠️ É LOSSY PARA O QUE FOI GRAVADO DEPOIS DA v245. Voltar a 1 casa faz o
--    banco arredondar de novo: 4.25 vira 4.3, para sempre. As 378 linhas que
--    existiam ANTES da v245 já tinham 1 casa e voltam idênticas — a perda é só
--    no que os técnicos salvarem entre a v245 e este rollback.
--
--    Por isso a trava abaixo: se já houver linha com 2 casas de verdade, ela
--    ABORTA e mostra quantas. Para regredir mesmo assim, comente o bloco DO —
--    mas saiba o que está jogando fora.
--
-- Nenhuma view/índice/constraint depende desta coluna (conferido em 22/09).
BEGIN;

DO $$
DECLARE
  n_duas int;
BEGIN
  SELECT count(*) INTO n_duas
    FROM public.aet_laudo_fatores_psi
   WHERE media IS NOT NULL
     AND media <> round(media, 1);

  IF n_duas > 0 THEN
    RAISE EXCEPTION
      'ABORTADO: % linha(s) tem media com 2 casas significativas, gravadas depois da v245. Voltar a numeric(3,1) as arredonda em silencio. NADA FOI ALTERADO.',
      n_duas;
  END IF;
END $$;

ALTER TABLE public.aet_laudo_fatores_psi
  ALTER COLUMN media TYPE numeric(3,1);

COMMENT ON COLUMN public.aet_laudo_fatores_psi.media IS NULL;

DELETE FROM public.schema_migrations
 WHERE version = 'v245_aet_fatores_psi_media_duas_casas';

COMMIT;

-- Depois: NOTIFY pgrst, 'reload schema';
