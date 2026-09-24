-- ============================================================
-- v142 — Excluir empresa volta a funcionar (FKs sem cascata)
-- ============================================================
-- Sintoma (relatado em 2026-07-29, duas usuárias, 7 tentativas):
--   "update or delete on table empresas violates foreign key constraint
--    extintores_id_empresa_fkey on table extintores"
--
-- Causa: a v60 criou `extintores.id_empresa` sem ON DELETE CASCADE, e a
-- `qps_aplicacoes` nasceu igual. Eram as 2 únicas exceções: das 35 FKs que
-- apontam para `empresas`, 31 já tinham CASCADE e 2 SET NULL.
--
-- Por que a cascata da inspeção não salvava: `extintores.id_inspecao` TEM
-- cascata, mas isso não basta. Ao apagar a empresa o Postgres enfileira a
-- verificação de `extintores.id_empresa` no nível de fora, e a cascata
-- `inspecoes → extintores` só entra na fila DEPOIS dela — quando a
-- verificação roda, a linha de extintor ainda existe e o DELETE aborta.
-- Resultado: nenhuma das 102 empresas com extintor (138 linhas) podia ser
-- excluída, e a `qps_aplicacoes` travava outras 2 — essa pior ainda, porque
-- não tem nenhum caminho em cascata, só o `id_empresa`.
--
-- CASCADE e não SET NULL: as duas colunas são NOT NULL, e o próprio diálogo
-- de confirmação do painel já promete levar os filhos junto. Extintor
-- pertence a uma inspeção que pertence à empresa; QPS é aplicação de
-- questionário da empresa.
--
-- Só troca a ação da FK — nenhuma linha de dado é apagada por esta migration.
-- Idempotente (DROP IF EXISTS + ADD) e testada na produção em 2026-07-30
-- dentro de BEGIN/ROLLBACK antes de virar arquivo.
-- ============================================================

BEGIN;

-- 1) extintores (v60) ----------------------------------------------------------
ALTER TABLE public.extintores
  DROP CONSTRAINT IF EXISTS extintores_id_empresa_fkey;

ALTER TABLE public.extintores
  ADD CONSTRAINT extintores_id_empresa_fkey
  FOREIGN KEY (id_empresa) REFERENCES public.empresas(id_empresa) ON DELETE CASCADE;

-- 2) qps_aplicacoes ------------------------------------------------------------
ALTER TABLE public.qps_aplicacoes
  DROP CONSTRAINT IF EXISTS qps_aplicacoes_id_empresa_fkey;

ALTER TABLE public.qps_aplicacoes
  ADD CONSTRAINT qps_aplicacoes_id_empresa_fkey
  FOREIGN KEY (id_empresa) REFERENCES public.empresas(id_empresa) ON DELETE CASCADE;

-- 3) Trava de sanidade ---------------------------------------------------------
-- Aborta a transação se sobrar QUALQUER FK apontando para `empresas` que
-- bloqueie o DELETE (NO ACTION / RESTRICT). Se uma tabela nova aparecer com
-- esse defeito no futuro, esta trava é o aviso.
DO $$
DECLARE
  bloqueantes TEXT;
BEGIN
  SELECT string_agg(conrelid::regclass || '.' || conname, ', ')
    INTO bloqueantes
    FROM pg_constraint
   WHERE contype = 'f'
     AND confrelid = 'public.empresas'::regclass
     AND confdeltype IN ('a', 'r');

  IF bloqueantes IS NOT NULL THEN
    RAISE EXCEPTION 'v142: ainda ha FK sem cascata apontando para empresas: %', bloqueantes;
  END IF;

  IF (SELECT confdeltype FROM pg_constraint
       WHERE conname = 'extintores_id_empresa_fkey') <> 'c' THEN
    RAISE EXCEPTION 'v142: extintores_id_empresa_fkey nao ficou como CASCADE';
  END IF;

  IF (SELECT confdeltype FROM pg_constraint
       WHERE conname = 'qps_aplicacoes_id_empresa_fkey') <> 'c' THEN
    RAISE EXCEPTION 'v142: qps_aplicacoes_id_empresa_fkey nao ficou como CASCADE';
  END IF;
END $$;

COMMIT;
