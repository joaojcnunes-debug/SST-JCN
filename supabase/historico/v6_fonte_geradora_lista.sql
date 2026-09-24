-- ============================================================
-- V6: Fonte Geradora vira lista (parallel aos EPIs/medidas)
-- ============================================================
-- Antes: cada modelo tinha um único campo `modelos_risco.fonte_geradora`
-- (texto). Agora: fonte vira uma das categorias de itens_modelo_risco,
-- permitindo múltiplas fontes por modelo.
--
-- A coluna modelos_risco.fonte_geradora é mantida (deprecada) pra não
-- quebrar nada — apenas deixa de ser exibida/escrita pelo código novo.
--
-- Idempotente.
-- ============================================================

-- 1) Atualiza CHECK constraint da categoria pra aceitar 'fonte_geradora'
alter table public.itens_modelo_risco
  drop constraint if exists itens_modelo_risco_categoria_check;

alter table public.itens_modelo_risco
  add constraint itens_modelo_risco_categoria_check
  check (categoria in (
    'fonte_geradora',
    'epi_utilizado',
    'epi_recomendado',
    'epc_utilizado',
    'epc_recomendado',
    'medida_adotada',
    'medida_recomendada'
  ));

-- 2) Migra fonte_geradora existente do modelos_risco pra itens_modelo_risco
INSERT INTO public.itens_modelo_risco (id_item, id_modelo, categoria, texto, ordem, ativo)
SELECT
  'ITM_' || md5(m.id_modelo || ':fonte_geradora:' || lower(m.fonte_geradora)),
  m.id_modelo,
  'fonte_geradora',
  m.fonte_geradora,
  0,
  true
FROM public.modelos_risco m
WHERE m.fonte_geradora IS NOT NULL AND length(trim(m.fonte_geradora)) > 0
ON CONFLICT (id_item) DO NOTHING;
