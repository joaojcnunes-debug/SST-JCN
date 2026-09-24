-- ROLLBACK da v248 — devolve aet_laudo_qps_respostas.id_setor a text.
--
-- É SEGURO E SEM PERDA: uuid → text devolve a forma canônica minúscula, que é
-- exatamente o que estava gravado antes da v248 (medido: 0 linhas com
-- maiúscula, espaço ou fora do formato). Nenhum valor muda.
--
-- O que se PERDE é a garantia: a coluna volta a aceitar id que não é uuid, e o
-- join com aet_laudo_fatores_psi volta a exigir `::text`.
--
-- Nenhuma view, política RLS ou índice (além da própria PK, reconstruída pelo
-- ALTER) depende desta coluna — conferido em 22/09/2026.
BEGIN;

DO $$
DECLARE
  tipo_atual text;
BEGIN
  SELECT data_type INTO tipo_atual
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='aet_laudo_qps_respostas'
     AND column_name='id_setor';

  IF tipo_atual <> 'uuid' THEN
    RAISE EXCEPTION 'ROLLBACK v248: id_setor nao e uuid (e %). Nada a reverter.', tipo_atual;
  END IF;
END $$;

ALTER TABLE public.aet_laudo_qps_respostas
  ALTER COLUMN id_setor TYPE text USING id_setor::text;

COMMENT ON COLUMN public.aet_laudo_qps_respostas.id_setor IS NULL;

-- Confere que o dado sobreviveu e que o join VOLTA a precisar de cast.
DO $$
DECLARE
  pares bigint;
BEGIN
  SELECT count(*) INTO pares
    FROM public.aet_laudo_fatores_psi f
    JOIN public.aet_laudo_qps_respostas r
      ON r.id_relatorio = f.id_relatorio
     AND r.id_setor     = f.id_setor::text
     AND r.codigo_fator = f.codigo_fator;
  RAISE NOTICE 'ROLLBACK v248 OK: % pares no join COM cast.', pares;
END $$;

DELETE FROM public.schema_migrations
 WHERE version = 'v248_aet_qps_respostas_id_setor_uuid';

COMMIT;

-- Depois: NOTIFY pgrst, 'reload schema';
