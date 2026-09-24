-- v122 — DRPS data_conclusao: carimbo automático (trigger) + backfill pontual.
--
-- CONTEXTO: `data_conclusao` (usado como {{data_conclusao}} na capa do laudo) só
-- era carimbado por 1 dos 5 caminhos que marcam o relatório como CONCLUIDO — os
-- demais (dropdown de status em analise/dashboard/metadados e o drag do kanban)
-- gravavam só o status. Sem trigger no banco, esses relatórios ficavam com
-- data_conclusao = NULL e a capa saía sem a data.
--
-- Esta migration:
--   1) cria um trigger BEFORE UPDATE que carimba data_conclusao na 1ª transição
--      para CONCLUIDO, seja qual for o caminho (fecha a causa raiz);
--   2) faz o backfill dos relatórios já concluídos sem data das empresas
--      informadas (correção retroativa com a data real fornecida).

-- 1) ── Trigger (idempotente) ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.drps_stamp_data_conclusao()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Só na 1ª vez que vira CONCLUIDO e se ainda não houver carimbo (preserva um
  -- valor já gravado pelo app / por reabertura-reconclusão).
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

-- 2) ── Backfill pontual (retroativo) ────────────────────────────────────────
-- Só preenche onde está NULL e status = CONCLUIDO; não sobrescreve nada já gravado.
-- Timestamp ao meio-dia -03 para não "virar o dia" por fuso na formatação do PDF.
DO $$
DECLARE
  n_century int;
  n_sinai   int;
BEGIN
  UPDATE public.drps_relatorios r
  SET data_conclusao = TIMESTAMPTZ '2026-06-02 12:00:00-03'
  FROM public.empresas e
  WHERE e.id_empresa = r.id_empresa
    AND e.nome_empresa ILIKE '%CENTURY%'
    AND r.status = 'CONCLUIDO'
    AND r.data_conclusao IS NULL;
  GET DIAGNOSTICS n_century = ROW_COUNT;

  UPDATE public.drps_relatorios r
  SET data_conclusao = TIMESTAMPTZ '2026-06-17 12:00:00-03'
  FROM public.empresas e
  WHERE e.id_empresa = r.id_empresa
    AND e.nome_empresa ILIKE '%MONTE SINAI%'
    AND r.status = 'CONCLUIDO'
    AND r.data_conclusao IS NULL;
  GET DIAGNOSTICS n_sinai = ROW_COUNT;

  RAISE NOTICE 'v122 backfill data_conclusao -> CENTURY: % linha(s), MONTE SINAI: % linha(s)', n_century, n_sinai;
  IF n_century = 0 THEN
    RAISE WARNING 'v122: nenhum DRPS CONCLUIDO sem data casou com CENTURY — conferir nome da empresa.';
  END IF;
  IF n_sinai = 0 THEN
    RAISE WARNING 'v122: nenhum DRPS CONCLUIDO sem data casou com MONTE SINAI — conferir nome da empresa.';
  END IF;
END $$;
