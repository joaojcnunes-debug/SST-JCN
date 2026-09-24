-- v244: o rótulo da terceira caixa da capa da QAP.
--
-- A capa da QAP nasceu na v243 como cópia da do DRPS. A terceira caixa do DRPS
-- diz "Data da conclusão: {{data_conclusao}}" — a data em que o relatório virou
-- CONCLUÍDO. A QAP não tem esse campo, então a v243 trocou a variável por
-- {{data_elaboracao}} e o rótulo ficou para trás: a capa imprimia a data de
-- ELABORAÇÃO com o nome "Data da conclusão". Conferido na prévia do laudo
-- QAP - TERE HORTIFRUTI em 22/09: saía "Data da conclusão: 20/08/2026".
--
-- Mexe só na capa da QAP. A do DRPS continua como está.
--
-- ROLLBACK: scripts/sql/v244_rollback_qps_capa_rotulo_elaboracao.sql
-- NO JCN: a capa da QAP nasce vazia (ver nota da v243), entao este UPDATE nao
-- encontra nada hoje. Fica aplicado para o rotulo ja sair certo se a capa vier
-- a ser montada com o texto antigo.

BEGIN;

UPDATE public.textos_padrao
   SET caixas_texto = replace(caixas_texto::text, 'Data da conclusão:', 'Data de elaboração:')::jsonb,
       updated_at   = now()
 WHERE modulo = 'qps' AND tipo = 'editavel' AND titulo = 'Capa'
   AND caixas_texto::text LIKE '%Data da conclusão:%';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.textos_padrao
              WHERE modulo = 'qps' AND titulo = 'Capa'
                AND caixas_texto::text LIKE '%Data da conclusão%') THEN
    RAISE EXCEPTION 'v244: a capa da QAP ainda diz "Data da conclusão".';
  END IF;
END $$;


COMMIT;
