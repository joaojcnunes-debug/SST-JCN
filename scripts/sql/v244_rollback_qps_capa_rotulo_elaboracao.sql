-- ROLLBACK da v244 — devolve o rótulo "Data da conclusão:" à capa da QAP.
BEGIN;

UPDATE public.textos_padrao
   SET caixas_texto = replace(caixas_texto::text, 'Data de elaboração:', 'Data da conclusão:')::jsonb
 WHERE modulo = 'qps' AND tipo = 'editavel' AND titulo = 'Capa';

DELETE FROM public.schema_migrations WHERE version = 'v244_qps_capa_rotulo_elaboracao';

COMMIT;
