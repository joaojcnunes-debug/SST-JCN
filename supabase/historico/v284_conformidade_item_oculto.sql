-- v284 (JCN) — Relatório de Conformidade: tópico do checklist OCULTO no PDF.
-- Replicado do Painel SST (v289, commit 24b802cb, v0.3.738), sem a trava de banco
-- do painel e sem schema_migrations.
--
-- O QUE FAZ: relatorios_conformidade_itens.oculto boolean NOT NULL DEFAULT false.
-- Oculto = fica no relatório (situação, fotos, observação), mas sai do PDF, da
-- prévia do laudo e da contagem do resumo. Volta com um clique.
--
-- REAPLICAR: idempotente.
-- ROLLBACK: ALTER TABLE public.relatorios_conformidade_itens DROP COLUMN oculto;

ALTER TABLE public.relatorios_conformidade_itens
  ADD COLUMN IF NOT EXISTS oculto boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.relatorios_conformidade_itens.oculto IS
  'v284 (painel v289): true = tópico fica no relatório mas sai do PDF/laudo e da contagem do resumo.';

NOTIFY pgrst, 'reload schema';
