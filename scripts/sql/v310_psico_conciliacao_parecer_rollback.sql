-- Rollback da v310 (Conciliação DRPS/QPS × AEP: parecer, fechamento e ligação de setores).
-- APAGA os pareceres, os fechamentos e as ligações de setor gravados. As ações 5W2H geradas
-- pelos pareceres ficam (são do Plano de Ação). Rode só se for desfazer de vez.

DROP TABLE IF EXISTS public.psico_conciliacao_fechamentos;
DROP TABLE IF EXISTS public.psico_conciliacao_pareceres;
DROP TABLE IF EXISTS public.psico_conciliacao_setor_depara;
DROP FUNCTION IF EXISTS public.psico_conciliacao_parecer_carimbo();
DROP FUNCTION IF EXISTS public.psico_conciliacao_fechamento_carimbo();
DELETE FROM public.auditoria_tabelas
 WHERE tabela IN ('psico_conciliacao_fechamentos', 'psico_conciliacao_pareceres', 'psico_conciliacao_setor_depara');

NOTIFY pgrst, 'reload schema';
