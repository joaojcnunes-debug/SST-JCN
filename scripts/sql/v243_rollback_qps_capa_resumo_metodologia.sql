-- ROLLBACK da v243 — desfaz capa/resumo/metodologia da QAP e devolve o Plano
-- de Ação 5W2H ao laudo.
--
-- ⚠ APAGA os três capítulos criados. Se alguém já reescreveu a Metodologia ou
-- escreveu o Resumo, o texto vai junto — o histórico fica em
-- `textos_padrao_versoes` (o trigger guarda cada versão), mas a linha viva não.
-- A guarda abaixo aborta se a Metodologia foi editada depois de criada.
BEGIN;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
    FROM public.textos_padrao
   WHERE modulo = 'qps' AND tipo = 'editavel'
     AND titulo IN ('Capa','Resumo','Metodologia')
     AND updated_at IS NOT NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'rollback v243: % capítulo(s) já foram editados depois de criados. Rode com esta guarda comentada se for mesmo para descartar.', n;
  END IF;
END $$;

DELETE FROM public.textos_padrao
 WHERE modulo = 'qps' AND tipo = 'editavel' AND titulo IN ('Capa','Resumo','Metodologia');

UPDATE public.textos_padrao
   SET ativo = true
 WHERE modulo = 'qps' AND tipo = 'fixo' AND slug_fixo = 'qps_plano_acao_5w2h';

-- Ordem de volta à de antes da v243 (0,10,…,80).
UPDATE public.textos_padrao t SET ordem = v.ordem
  FROM (VALUES
    ('sumario',                0),
    ('identificacao_empresa', 10),
    ('qps_caracterizacao',    20),
    ('qps_analise_setor',     30),
    ('qps_conclusao',         40),
    ('qps_plano_medidas',     50),
    ('qps_plano_acao_5w2h',   60),
    ('qps_revisao',           70),
    ('qps_assinatura',        80)
  ) AS v(slug, ordem)
 WHERE t.modulo = 'qps' AND t.tipo = 'fixo' AND t.slug_fixo = v.slug;

DELETE FROM public.schema_migrations WHERE version = 'v243_qps_capa_resumo_metodologia';

COMMIT;
