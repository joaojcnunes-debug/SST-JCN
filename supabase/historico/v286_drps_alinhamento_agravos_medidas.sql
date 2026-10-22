-- v286 (JCN) — DRPS: alinhamento dos quadros de Agravos e Medidas (botões do Word).
-- Replicado do Painel SST (v291, commit eb1c7b40, v0.3.742), sem a trava de banco.
--
-- drps_relatorios.alinhamentos_por_setor          jsonb {setor: {agravos, medidas}}
-- drps_relatorios.alinhamentos_por_unidade_setor  jsonb {unidade: {setor: {...}}}
-- Valores: left | center | right | justify. Ausente = justificado (como os quadros
-- saem desde esta versão) — nenhum laudo existente muda de conteúdo.
--
-- REAPLICAR: idempotente.
-- ROLLBACK: ALTER TABLE public.drps_relatorios DROP COLUMN alinhamentos_por_setor,
--                                              DROP COLUMN alinhamentos_por_unidade_setor;

ALTER TABLE public.drps_relatorios
  ADD COLUMN IF NOT EXISTS alinhamentos_por_setor jsonb,
  ADD COLUMN IF NOT EXISTS alinhamentos_por_unidade_setor jsonb;

COMMENT ON COLUMN public.drps_relatorios.alinhamentos_por_setor IS
  'v286 (painel v291): {setor: {agravos, medidas}} = left|center|right|justify. Ausente = justify.';
COMMENT ON COLUMN public.drps_relatorios.alinhamentos_por_unidade_setor IS
  'v286 (painel v291): override por unidade {unidade: {setor: {agravos, medidas}}}; herda do por_setor.';

NOTIFY pgrst, 'reload schema';
