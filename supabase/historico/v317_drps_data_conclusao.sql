-- v317 — DRPS: data de conclusão carimbada por qualquer caminho + acerto dos 2 antigos (03/11/2026).
--
-- `data_conclusao` vira {{data_conclusao}} na capa do laudo. Só o botão "Concluir Análise"
-- gravava a data; os menus de status (Metadados, Dashboard, barra da Análise) e o kanban
-- gravavam só o status, e a capa saía sem data. O gatilho é o mesmo de
-- supabase/fila/v122_drps_data_conclusao_fix.sql (nunca aplicado no JCN); o acerto em lote de
-- lá era de empresas do Painel e NÃO foi aplicado aqui.
-- Rollback: scripts/sql/v317_drps_data_conclusao_rollback.sql

-- 1) Gatilho: na 1ª vez que vira CONCLUIDO, se ainda não houver data.
CREATE OR REPLACE FUNCTION public.drps_stamp_data_conclusao()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'CONCLUIDO'
     AND OLD.status IS DISTINCT FROM 'CONCLUIDO'
     AND NEW.data_conclusao IS NULL THEN
    NEW.data_conclusao := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_drps_stamp_data_conclusao ON public.drps_relatorios;
CREATE TRIGGER trg_drps_stamp_data_conclusao
  BEFORE UPDATE ON public.drps_relatorios
  FOR EACH ROW EXECUTE FUNCTION public.drps_stamp_data_conclusao();

-- 2) Os 2 DRPS concluídos sem data (decisão do João, 03/11/2026): a data do histórico; sem
--    histórico, a de elaboração. Meio-dia -03 para não "virar o dia" por fuso no PDF.
--    Só preenche onde está vazio.
UPDATE public.drps_relatorios
   SET data_conclusao = TIMESTAMPTZ '2026-09-25 12:00:00-03'
 WHERE id_relatorio = 'DRPS-225D2095' AND status = 'CONCLUIDO' AND data_conclusao IS NULL;

UPDATE public.drps_relatorios
   SET data_conclusao = TIMESTAMPTZ '2026-06-09 12:00:00-03'
 WHERE id_relatorio = 'DRPS-A45EFF4D' AND status = 'CONCLUIDO' AND data_conclusao IS NULL;
