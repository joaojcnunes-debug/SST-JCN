-- Rollback da v317 (DRPS data de conclusão).
-- Tira o gatilho e devolve os 2 DRPS antigos para "sem data" (só se ainda tiverem a data posta
-- pela v317; uma data gravada depois pelo app fica).
DROP TRIGGER IF EXISTS trg_drps_stamp_data_conclusao ON public.drps_relatorios;
DROP FUNCTION IF EXISTS public.drps_stamp_data_conclusao();

UPDATE public.drps_relatorios SET data_conclusao = NULL
 WHERE id_relatorio = 'DRPS-225D2095' AND data_conclusao = TIMESTAMPTZ '2026-09-25 12:00:00-03';
UPDATE public.drps_relatorios SET data_conclusao = NULL
 WHERE id_relatorio = 'DRPS-A45EFF4D' AND data_conclusao = TIMESTAMPTZ '2026-06-09 12:00:00-03';
