-- Rollback da v193 — recria o índice duplicado de escala_dias.
--
-- ⚠️ Mora em `scripts/sql/` e NÃO em `supabase/migrations/`, porque o
-- `migrate.ps1` varre aquela pasta e aplicaria o rollback como se fosse
-- migration. Foi o erro cometido com a v138 em julho.
--
-- Só faça isto se surgir uma medição mostrando que o índice não-único ajuda em
-- algo — o que seria surpreendente: ele é idêntico ao único em colunas e ordem.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_escala_dias_sup_data
  ON public.escala_dias USING btree (id_supervisor, data);

DELETE FROM public.schema_migrations
 WHERE version = 'v193_escala_remove_indice_duplicado';

COMMIT;
