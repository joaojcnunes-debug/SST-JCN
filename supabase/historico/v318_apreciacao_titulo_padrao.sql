-- v318 — Apreciação de Máquinas: título padrão nos laudos que nasceram sem título (03/11/2026).
--
-- A tela Nova dizia que o título é sempre "Apreciação de Máquinas NR-12", mas gravava nulo, e
-- {{titulo}} saía vazio nos textos padrão. A 0.3.220 passa a gravar o título (e a cidade/UF do
-- cadastro da empresa) ao criar; aqui os 5 laudos existentes ganham o título. A cidade não
-- entra: 4 deles são de empresas sem município no cadastro e o 5º já tinha cidade.
-- Rollback: scripts/sql/v318_apreciacao_titulo_padrao_rollback.sql
UPDATE public.apreciacoes_maquinas
   SET titulo = 'Apreciação de Máquinas NR-12'
 WHERE titulo IS NULL;
