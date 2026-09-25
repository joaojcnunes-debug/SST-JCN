-- v259 — AEP e AET preenchidas dentro da inspeção (abas AEP / AET).
--
-- Pedido em 2026-09-25: preencher a AEP e a AET completas na tela da inspeção
-- e, com o botão "Enviar para o módulo", deixá-las disponíveis nos módulos
-- AEP e AET que já existem.
--
-- Desenho: o laudo nasce na PRÓPRIA tabela do módulo (aep_relatorios /
-- aet_relatorios), com `id_inspecao` apontando para a inspeção. Assim as
-- mesmas telas dos módulos editam o laudo dentro da aba, e as tabelas-satélite
-- do AET (ações, 13 fatores, QPS do laudo) funcionam sem cópia.
--   · enviado_modulo_em NULL  → só aparece na inspeção (as listas dos módulos
--                                filtram `id_inspecao is null or enviado_modulo_em is not null`);
--   · enviado_modulo_em preenchido → aparece no módulo; continua o MESMO laudo.
-- Laudos antigos têm id_inspecao NULL e seguem visíveis como sempre.
--
-- Uma AEP e uma AET por inspeção (índice único parcial).
-- Rollback: scripts/sql/v259_rollback_aep_aet_da_inspecao.sql

begin;

alter table public.aep_relatorios
  add column if not exists id_inspecao text references public.inspecoes(id_inspecao) on delete set null,
  add column if not exists enviado_modulo_em timestamptz;
alter table public.aet_relatorios
  add column if not exists id_inspecao text references public.inspecoes(id_inspecao) on delete set null,
  add column if not exists enviado_modulo_em timestamptz;

create unique index if not exists aep_relatorios_id_inspecao_uq
  on public.aep_relatorios (id_inspecao) where id_inspecao is not null;
create unique index if not exists aet_relatorios_id_inspecao_uq
  on public.aet_relatorios (id_inspecao) where id_inspecao is not null;

comment on column public.aep_relatorios.id_inspecao is
  'Inspeção onde a AEP foi preenchida (aba AEP). NULL = criada no próprio módulo (v259).';
comment on column public.aep_relatorios.enviado_modulo_em is
  'Quando a AEP da inspeção foi liberada no módulo. NULL com id_inspecao = só na inspeção (v259).';
comment on column public.aet_relatorios.id_inspecao is
  'Inspeção onde a AET foi preenchida (aba AET). NULL = criada no próprio módulo (v259).';
comment on column public.aet_relatorios.enviado_modulo_em is
  'Quando a AET da inspeção foi liberada no módulo. NULL com id_inspecao = só na inspeção (v259).';

commit;
