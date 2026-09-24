-- Rollback da v226 (laudo do QPS). Tira o módulo 'qps' dos textos padrão
-- (apaga os capítulos do módulo — inclusive os que o psicólogo tiver escrito;
-- meça antes: select count(*) from textos_padrao where modulo = 'qps'), apaga
-- crp/data_elaboracao da aplicação e recompõe o CHECK antigo.
-- NÃO recria qps_planos_acao: estava vazia; para tê-la de volta, rode a
-- migration que a criou.
BEGIN;
DELETE FROM public.textos_padrao WHERE modulo = 'qps';
ALTER TABLE public.textos_padrao DROP CONSTRAINT IF EXISTS textos_padrao_modulo_check;
ALTER TABLE public.textos_padrao ADD CONSTRAINT textos_padrao_modulo_check
  CHECK (modulo = ANY (ARRAY['sst','conformidade','nao_conformidade','analise_quimicos',
                             'apreciacao_maquinas','aep','aet','psicossocial','plano_acao']));
ALTER TABLE public.qps_aplicacoes
  DROP COLUMN IF EXISTS crp,
  DROP COLUMN IF EXISTS data_elaboracao;
DELETE FROM public.schema_migrations WHERE version = 'v226_qps_laudo_igual_drps';
COMMIT;
NOTIFY pgrst, 'reload schema';
