-- Rollback da v225 (tabelas de gestão do QPS). Apaga tudo o que o psicólogo
-- tiver gravado nas 4 telas (5W2H, medidas, monitoramento, revisão) — rode só
-- se as telas forem retiradas do ar. Antes, meça: select count(*) em cada uma.
BEGIN;
SELECT public.auditoria_desativar('qps_plano_acao_5w2h');
SELECT public.auditoria_desativar('qps_plano_medidas');
SELECT public.auditoria_desativar('qps_monitoramento');
SELECT public.auditoria_desativar('qps_revisao');
DELETE FROM public.auditoria_tabelas
 WHERE tabela IN ('qps_plano_acao_5w2h', 'qps_plano_medidas', 'qps_monitoramento', 'qps_revisao');
DROP TABLE IF EXISTS public.qps_plano_acao_5w2h;
DROP TABLE IF EXISTS public.qps_plano_medidas;
DROP TABLE IF EXISTS public.qps_monitoramento;
DROP TABLE IF EXISTS public.qps_revisao;
DELETE FROM public.schema_migrations WHERE version = 'v225_qps_gestao_igual_drps';
COMMIT;
NOTIFY pgrst, 'reload schema';
