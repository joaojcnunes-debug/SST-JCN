-- v201 — Nova aplicação passa a pedir 2 dados. Decisão dele em 2026-09-04.
--
-- ─── trabalhadores_previstos ────────────────────────────────────────────────
-- É o DENOMINADOR da taxa de participação. Hoje o painel sabe quantos
-- responderam (620 em 04/09) mas não quantos DEVERIAM responder — então não há
-- como dizer se 129 respondentes numa empresa é ótimo ou péssimo.
--
-- 🔑 NÃO DAVA PARA PEGAR EMPRESTADO. O DRPS tem `qtd_trabalhadores` em
-- drps_relatorios e drps_empresa_config, e a ideia óbvia era copiar de lá.
-- Medido em 04/09: das 14 empresas com aplicação de questionário, **ZERO** tem
-- esse campo preenchido no DRPS. Não há de onde copiar; é dado novo mesmo.
-- (Os dois módulos também não têm nenhuma chave em comum.)
--
-- ─── unidade_cliente ────────────────────────────────────────────────────────
-- É a filial/unidade DO CLIENTE. NÃO confundir com a unidade da Chabra, que já
-- existe e sai de graça por empresas.id_unidade.
--
-- 🔑 ENTRA PORQUE JÁ ESTÁ ACONTECENDO. Medido em 04/09: 5 aplicações com 580
-- respondentes estão gravadas sob uma ÚNICA empresa do painel e se distinguem
-- apenas por texto digitado no título:
--     "QAP - TERE HORTIFRUTI ... LTDA - 20"   129 respondentes
--     "QAP - TERE FRUTAS ... LTDA - 28"       126
--     "QAP - TERE FRUTAS ... LTDA - 47"        57
-- As pessoas estão improvisando à mão um campo que não existe.
--
-- ─── Por que aditiva e nullable ─────────────────────────────────────────────
-- As 21 aplicações existentes seguem válidas sem tocar em uma linha, e a taxa
-- de participação só aparece para quem preencher. A tela de detalhe ganhou
-- edição em linha dos dois campos justamente para que as aplicações antigas
-- possam receber o número depois.
--
-- ─── GRANT ──────────────────────────────────────────────────────────────────
-- Conferido antes de escrever: os privilégios de qps_aplicacoes são de TABELA
-- (role_table_grants), não por coluna. Coluna nova já nasce alcançável por
-- `authenticated`; não é preciso GRANT novo. Se algum dia virarem por coluna,
-- esta migration precisa de um GRANT explícito — é a armadilha da v194.

alter table public.qps_aplicacoes
  add column if not exists trabalhadores_previstos integer,
  add column if not exists unidade_cliente text;

-- Zero ou negativo não é "não informado", é erro de digitação: quem não sabe
-- deixa em branco (NULL). Sem esta guarda, um 0 viraria divisão por zero na
-- taxa de participação.
alter table public.qps_aplicacoes
  drop constraint if exists qps_aplicacoes_trabalhadores_previstos_check;
alter table public.qps_aplicacoes
  add constraint qps_aplicacoes_trabalhadores_previstos_check
  check (trabalhadores_previstos is null or trabalhadores_previstos > 0);

comment on column public.qps_aplicacoes.trabalhadores_previstos is
  'Quantos trabalhadores deveriam responder. Denominador da taxa de participacao. NULL = nao informado.';
comment on column public.qps_aplicacoes.unidade_cliente is
  'Unidade/filial DO CLIENTE. Nao e a unidade da Chabra, que vem de empresas.id_unidade.';
