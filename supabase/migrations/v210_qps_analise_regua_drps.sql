-- v210: tela "Análise" dos Questionários Psicossociais com a régua do DRPS
-- (pedido do Sanmyo, 14/09/2026).
--
-- A resposta passa a definir a GRAVIDADE (conta do DRPS) e o psicólogo informa a
-- PROBABILIDADE — que já cabe em `qps_probabilidades` (setor = '*' guarda a da
-- aplicação inteira; setor real é ajuste daquele setor). O que faltava de lugar:
--
--   • qps_categorias.fonte_geradora — "Fontes Geradoras do Risco", que o DRPS
--     tem fixo por tópico e o QPS não tinha em lugar nenhum;
--   • qps_aplicacoes.{agravos,medidas,conclusoes}_por_setor — o mesmo desenho
--     de `drps_relatorios` (mapa setor → texto; '*' = consolidado).
--
-- Só ADD COLUMN, tudo nullable: nenhuma linha muda, nenhuma tela antiga lê
-- estas colunas. Sem dado a migrar. O PostgREST precisa recarregar o schema
-- (NOTIFY abaixo) — sem isso a tela nova responde "coluna não encontrada".
BEGIN;

ALTER TABLE public.qps_categorias
  ADD COLUMN IF NOT EXISTS fonte_geradora text;

ALTER TABLE public.qps_aplicacoes
  ADD COLUMN IF NOT EXISTS agravos_por_setor    jsonb,
  ADD COLUMN IF NOT EXISTS medidas_por_setor    jsonb,
  ADD COLUMN IF NOT EXISTS conclusoes_por_setor jsonb;

COMMENT ON COLUMN public.qps_categorias.fonte_geradora IS
  'v210 — Fontes Geradoras do Risco (tela Análise, régua do DRPS).';
COMMENT ON COLUMN public.qps_aplicacoes.conclusoes_por_setor IS
  'v210 — conclusão do psicólogo por setor; chave "*" = consolidado (todos os setores).';


COMMIT;

NOTIFY pgrst, 'reload schema';
