-- v146 — Apreciação NR-12: ficha de risco por máquina (risco residual, medidas
-- separadas e constatações de inspeção).
--
-- CONTEXTO: a seção 4 do laudo de referência traz, por máquina, uma tabela
-- Perigo | Origem/Consequências | Item NR-12 | Risco Inicial | Medidas de
-- Controle (Eng./Adm.) | Risco Residual, mais um parecer técnico. O painel já
-- coletava perigo, origem, consequências, item NR-12 e o risco INICIAL — e nada
-- disso chegava ao PDF (a rota nem consultava a tabela). Faltavam no banco:
-- o risco RESIDUAL, a separação das medidas e as constatações.
--
-- SEGURANÇA DO DADO:
--   * `apreciacao_riscos_hrn` tem ZERO linhas no sistema inteiro (medido em
--     2026-07-30) — justamente porque nada dela era impresso.
--   * `medidas_preventivas` NÃO é tocada. As duas colunas novas são adicionais;
--     o que estiver no campo antigo continua lá e legível.
--   * `conclusao_tecnica` (9 de 12 apreciações preenchidas) NÃO é tocada: ela já
--     é o parecer técnico do documento e passa a ser impressa dentro da ficha,
--     no lugar de seção solta. Nenhum campo novo para isso.
--   * Todas as 12 apreciações estão em RASCUNHO — nenhum laudo finalizado.
--
-- Aditiva e idempotente: todas as colunas nullable, sem default, sem backfill,
-- nenhuma linha existente é alterada. RLS não muda (as colunas herdam as
-- policies da tabela). Rodar com `psql -1` para ter transação única.
--
-- Sem CHECK constraint de propósito: as colunas `pod`/`fep`/`gpd` que já existem
-- também não têm, e criar a regra só nas gêmeas residuais deixaria a tabela
-- inconsistente. A validação dos valores continua na aplicação.

-- ── 1) Risco residual por linha de perigo ────────────────────────────────────
alter table public.apreciacao_riscos_hrn
  add column if not exists pod_residual text,
  add column if not exists fep_residual text,
  add column if not exists gpd_residual text,
  add column if not exists classificacao_residual text;

comment on column public.apreciacao_riscos_hrn.pod_residual is
  'Probabilidade de ocorrência do dano APÓS as medidas de controle. Mesmo vocabulário de `pod`.';
comment on column public.apreciacao_riscos_hrn.fep_residual is
  'Frequência de exposição ao perigo após as medidas. Mesmo vocabulário de `fep`.';
comment on column public.apreciacao_riscos_hrn.gpd_residual is
  'Gravidade potencial do dano após as medidas. Mesmo vocabulário de `gpd`.';
comment on column public.apreciacao_riscos_hrn.classificacao_residual is
  'Classificação do risco residual. Sugerida pela mesma régua do risco inicial e sobrescrevível pelo técnico — o valor gravado é o que vale.';

-- ── 2) Medidas separadas em Engenharia e Administrativas ─────────────────────
alter table public.apreciacao_riscos_hrn
  add column if not exists medidas_engenharia text,
  add column if not exists medidas_administrativas text;

comment on column public.apreciacao_riscos_hrn.medidas_engenharia is
  'Medidas de proteção de engenharia (proteções, intertravamentos, frenagem). Sai como "Eng.:" na ficha.';
comment on column public.apreciacao_riscos_hrn.medidas_administrativas is
  'Medidas administrativas (capacitação, procedimento, EPI). Sai como "Adm.:" na ficha.';
comment on column public.apreciacao_riscos_hrn.medidas_preventivas is
  'LEGADO (anterior à v146): campo único de medidas. Mantido para não perder o que já foi escrito; a ficha usa `medidas_engenharia` e `medidas_administrativas`.';

-- ── 3) Constatações da inspeção, por máquina ─────────────────────────────────
alter table public.apreciacoes_maquinas
  add column if not exists constatacoes_inspecao text;

comment on column public.apreciacoes_maquinas.constatacoes_inspecao is
  'Narrativa do que foi verificado em campo naquela máquina. Sai acima da tabela de risco na ficha. Não confundir com `observacoes_gerais` (nunca usada, 0 de 12) nem com `conclusao_tecnica`, que é o parecer e sai depois da tabela.';
