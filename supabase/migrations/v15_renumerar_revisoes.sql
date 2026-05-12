-- V15 — Renumera revisões existentes de forma sequencial por empresa
--
-- Antes do fix do form de Nova Inspeção, inspeções do tipo BRANCO e
-- COPIA_EMPRESA gravavam sempre revisao=1, gerando duplicatas dentro da
-- mesma empresa. Esta migration reordena por created_at e atribui
-- 1, 2, 3, ... a cada inspeção dentro de cada empresa.
--
-- Critério: ordem cronológica de created_at (com id_inspecao como
-- desempate determinístico). Inspeções DELETADA contam para manter o
-- histórico de numeração consistente com a lógica atual do app.

WITH numerada AS (
  SELECT
    id_inspecao,
    ROW_NUMBER() OVER (
      PARTITION BY id_empresa
      ORDER BY created_at ASC, id_inspecao ASC
    ) AS nova_revisao
  FROM public.inspecoes
)
UPDATE public.inspecoes i
   SET revisao = n.nova_revisao,
       updated_at = NOW()
  FROM numerada n
 WHERE i.id_inspecao = n.id_inspecao
   AND (i.revisao IS NULL OR i.revisao <> n.nova_revisao);
