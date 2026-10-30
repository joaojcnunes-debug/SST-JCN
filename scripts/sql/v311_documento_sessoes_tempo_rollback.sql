-- Rollback da v311 (apontamento de tempo do documento). APAGA as sessões gravadas.
-- O início da elaboração (v309) fica como está.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'documento-sessoes-inativas') THEN
    PERFORM cron.unschedule('documento-sessoes-inativas');
  END IF;
END $$;
DROP TRIGGER IF EXISTS trg_documento_sessoes_fechar_por_status ON public.inspecoes;
DROP FUNCTION IF EXISTS public.documento_sessoes_fechar_por_status_trg();
DROP FUNCTION IF EXISTS public.documento_sessao_iniciar(text);
DROP FUNCTION IF EXISTS public.documento_sessao_pausar(text, text);
DROP FUNCTION IF EXISTS public.documento_sessao_atividade(text);
DROP FUNCTION IF EXISTS public.documento_sessao_quem(text);
DROP FUNCTION IF EXISTS public.documento_sessoes_fechar_inativas();
DROP TABLE IF EXISTS public.documento_sessoes;
DELETE FROM public.auditoria_tabelas WHERE tabela = 'documento_sessoes';

NOTIFY pgrst, 'reload schema';
