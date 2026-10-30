-- Rollback da v312 (correção de sessão pelo supervisor). APAGA o histórico de correções;
-- as sessões ficam com os horários já corrigidos.

DROP FUNCTION IF EXISTS public.documento_sessao_corrigir(text, timestamptz, timestamptz, text);
DROP TABLE IF EXISTS public.documento_sessoes_correcoes;
DELETE FROM public.auditoria_tabelas WHERE tabela = 'documento_sessoes_correcoes';
ALTER TABLE public.documento_sessoes DROP COLUMN IF EXISTS corrigida;

NOTIFY pgrst, 'reload schema';
