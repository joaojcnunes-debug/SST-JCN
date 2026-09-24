-- v193 — remove o índice duplicado de escala_dias
--
-- ACHADO NO QA DA FASE 8. A v190 criou DOIS índices sobre as mesmas colunas da
-- mesma tabela:
--
--   escala_dias_unico_por_supervisor_data  UNIQUE (id_supervisor, data)
--   idx_escala_dias_sup_data                      (id_supervisor, data)
--
-- O segundo não serve para nada que o primeiro já não sirva: um índice único
-- é um btree comum com uma restrição a mais, e o planejador o usa nas mesmas
-- buscas e ordenações. Manter os dois custa tempo em toda gravação (dois
-- índices para atualizar em cada INSERT/UPDATE) e espaço em disco.
--
-- POR QUE AGORA: medido em 01/09, `escala_dias` está VAZIA e os dois índices
-- ocupam 8 KB cada, com 0 varreduras. É o momento mais barato possível — não há
-- dado para reconstruir, e o módulo ainda não entrou em uso.
--
-- A TRAVA ABAIXO É O QUE TORNA ISTO SEGURO: se o índice ÚNICO não existir, o
-- script ABORTA em vez de deixar a tabela sem nenhum índice em
-- (id_supervisor, data) — que é a coluna pela qual a grade mensal e a geração
-- procuram. Perder esse índice em silêncio seria trocar um desperdício pequeno
-- por uma varredura sequencial em toda leitura de mês.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename  = 'escala_dias'
       AND indexname  = 'escala_dias_unico_por_supervisor_data'
  ) THEN
    RAISE EXCEPTION
      'v193 abortada: o indice unico escala_dias_unico_por_supervisor_data nao existe. '
      'Remover idx_escala_dias_sup_data deixaria (id_supervisor, data) sem indice.';
  END IF;
END $$;

DROP INDEX IF EXISTS public.idx_escala_dias_sup_data;

INSERT INTO public.schema_migrations (version)
VALUES ('v193_escala_remove_indice_duplicado')
ON CONFLICT DO NOTHING;

COMMIT;
