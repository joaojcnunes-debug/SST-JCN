-- v285 (JCN) — QPS: data de conclusão (capa do laudo) e carimbo de cada resposta.
-- Replicado do Painel SST (v263, commit 71c34171, v0.3.670) — SÓ A PARTE DE ESTRUTURA.
--
-- O QUE FAZ
--   1) qps_aplicacoes.data_conclusao + gatilho que carimba o dia da 1ª conclusão
--      (ao reconcluir, a tela pergunta "manter ou hoje"). Concluídas antigas recebem
--      o dia da última passagem para CONCLUIDO na auditoria (sem registro: a data da
--      última alteração). Medido em 22/10/2026: nenhuma aplicação concluída no JCN.
--   2) qps_respondentes.data_carimbo ("Carimbo de data/hora" do Forms): dá o período
--      da coleta no laudo; a importação passa a gravar.
--
-- FORA (de propósito): as partes 3–5 da v263 do painel mexem no TEXTO PADRÃO do QPS
-- (capa, metodologia e 5 capítulos copiados do DRPS). No JCN os capítulos do QPS
-- estão vazios e os do DRPS têm outros títulos — o texto é da equipe da JCN.
--
-- REAPLICAR: idempotente.
-- ROLLBACK: scripts/sql/v285_qps_data_conclusao_e_carimbo_rollback.sql

ALTER TABLE public.qps_aplicacoes ADD COLUMN IF NOT EXISTS data_conclusao date;

UPDATE public.qps_aplicacoes a
   SET data_conclusao = coalesce(
         (SELECT (max(e.ocorrido_em) AT TIME ZONE 'America/Sao_Paulo')::date
            FROM public.auditoria_eventos e
           WHERE e.tabela = 'qps_aplicacoes'
             AND e.registro_id = a.id_aplicacao::text
             AND e.depois->>'status' = 'CONCLUIDO'
             AND e.antes->>'status' IS DISTINCT FROM 'CONCLUIDO'),
         (coalesce(a.atualizado_em, a.criado_em) AT TIME ZONE 'America/Sao_Paulo')::date)
 WHERE a.status IN ('CONCLUIDO', 'ENVIADO_CLIENTE')
   AND a.data_conclusao IS NULL;

CREATE OR REPLACE FUNCTION public.qps_carimbar_data_conclusao()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'CONCLUIDO'
     AND OLD.status IS DISTINCT FROM 'CONCLUIDO'
     AND NEW.data_conclusao IS NULL THEN
    NEW.data_conclusao := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_qps_carimbar_data_conclusao ON public.qps_aplicacoes;
CREATE TRIGGER trg_qps_carimbar_data_conclusao
  BEFORE UPDATE OF status ON public.qps_aplicacoes
  FOR EACH ROW EXECUTE FUNCTION public.qps_carimbar_data_conclusao();

ALTER TABLE public.qps_respondentes ADD COLUMN IF NOT EXISTS data_carimbo timestamptz;

NOTIFY pgrst, 'reload schema';
