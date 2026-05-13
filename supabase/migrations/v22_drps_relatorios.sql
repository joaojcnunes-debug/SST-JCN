-- V22 — Migração pra modelo de "múltiplos relatórios por empresa"
--
-- Antes: 1 conjunto de dados por empresa (drps_respondentes, probabilidades,
-- etc. apontavam direto pra id_empresa). drps_empresa_config guardava
-- metadados num registro único por empresa.
--
-- Agora: cada empresa pode ter N relatórios DRPS. Cada relatório tem seus
-- próprios metadados, respondentes, probabilidades, plano de medidas,
-- monitoramento e revisão. Revisão numerada sequencialmente por empresa.
--
-- IMPORTANTE: este migration TRUNCA todas as tabelas filhas, porque os dados
-- antigos não têm vínculo com relatório. Faça backup se precisar antes.

-- 1) Zera dados antigos (não tem como migrar sem perder referência a "qual
--    relatório eles seriam")
truncate
  public.drps_respondentes,
  public.drps_probabilidades,
  public.drps_monitoramento,
  public.drps_plano_medidas,
  public.drps_revisao,
  public.drps_empresa_config
  restart identity cascade;

-- 2) Tabela principal: drps_relatorios
create table if not exists public.drps_relatorios (
  id_relatorio          text primary key,
  id_empresa            text not null references public.empresas(id_empresa) on delete cascade,
  revisao               smallint not null,
  status                text not null default 'EM_ANDAMENTO'
                        check (status in ('RASCUNHO','EM_ANDAMENTO','CONCLUIDO','DELETADO')),
  data_elaboracao       date,

  -- Metadados (antes em drps_empresa_config — agora por relatório)
  responsavel_tecnico   text,
  crp                   text,
  funcoes               text,
  qtd_trabalhadores     integer,
  qtd_homens            integer,
  qtd_mulheres          integer,
  agravos_saude_mental  text,
  medidas_existentes    text,

  -- Auditoria
  usuario_email         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz
);

create index if not exists idx_drps_relatorios_empresa
  on public.drps_relatorios (id_empresa, revisao desc);

create index if not exists idx_drps_relatorios_status
  on public.drps_relatorios (status) where status <> 'DELETADO';

alter table public.drps_relatorios enable row level security;

drop policy if exists "auth read drps_relatorios" on public.drps_relatorios;
create policy "auth read drps_relatorios"
  on public.drps_relatorios for select to authenticated using (true);

drop policy if exists "auth write drps_relatorios" on public.drps_relatorios;
create policy "auth write drps_relatorios"
  on public.drps_relatorios for all to authenticated using (true) with check (true);

-- 3) Adicionar id_relatorio nas tabelas filhas (com FK cascade)
alter table public.drps_respondentes
  add column if not exists id_relatorio text
  references public.drps_relatorios(id_relatorio) on delete cascade;
alter table public.drps_respondentes
  alter column id_relatorio set not null;
create index if not exists idx_drps_resp_relatorio
  on public.drps_respondentes (id_relatorio);

alter table public.drps_probabilidades
  add column if not exists id_relatorio text
  references public.drps_relatorios(id_relatorio) on delete cascade;
alter table public.drps_probabilidades
  alter column id_relatorio set not null;
create index if not exists idx_drps_prob_relatorio
  on public.drps_probabilidades (id_relatorio);

alter table public.drps_monitoramento
  add column if not exists id_relatorio text
  references public.drps_relatorios(id_relatorio) on delete cascade;
alter table public.drps_monitoramento
  alter column id_relatorio set not null;
create index if not exists idx_drps_monit_relatorio
  on public.drps_monitoramento (id_relatorio);

alter table public.drps_plano_medidas
  add column if not exists id_relatorio text
  references public.drps_relatorios(id_relatorio) on delete cascade;
alter table public.drps_plano_medidas
  alter column id_relatorio set not null;
create index if not exists idx_drps_plano_relatorio
  on public.drps_plano_medidas (id_relatorio);

alter table public.drps_revisao
  add column if not exists id_relatorio text
  references public.drps_relatorios(id_relatorio) on delete cascade;
alter table public.drps_revisao
  alter column id_relatorio set not null;
create index if not exists idx_drps_revisao_relatorio
  on public.drps_revisao (id_relatorio);

-- 4) Reconfigurar PKs/uniques nas tabelas filhas para serem por relatório
--    (não mais por empresa).

-- drps_probabilidades: era PK (id_empresa, setor, topico_idx)
--                      vira PK (id_relatorio, setor, topico_idx)
alter table public.drps_probabilidades drop constraint if exists drps_probabilidades_pkey;
alter table public.drps_probabilidades
  add constraint drps_probabilidades_pkey
  primary key (id_relatorio, setor, topico_idx);

-- drps_monitoramento: idem
alter table public.drps_monitoramento drop constraint if exists drps_monitoramento_pkey;
alter table public.drps_monitoramento
  add constraint drps_monitoramento_pkey
  primary key (id_relatorio, setor, topico_idx);

-- drps_plano_medidas: era PK (id_empresa, ano) → vira (id_relatorio, ano)
alter table public.drps_plano_medidas drop constraint if exists drps_plano_medidas_pkey;
alter table public.drps_plano_medidas
  add constraint drps_plano_medidas_pkey
  primary key (id_relatorio, ano);

-- drps_revisao: era PK (id_empresa) → vira (id_relatorio)
alter table public.drps_revisao drop constraint if exists drps_revisao_pkey;
alter table public.drps_revisao
  add constraint drps_revisao_pkey
  primary key (id_relatorio);

-- 5) Limpa colunas id_empresa redundantes das tabelas filhas (não precisamos
--    mais — relatório já vincula à empresa). Mantemos a FK só onde fizer
--    sentido pra queries diretas (drps_respondentes ainda usa setor por
--    empresa em alguns lugares).
--    Decisão: MANTER id_empresa nas tabelas filhas como denormalização,
--    facilita queries e auditoria. Cai junto via cascade quando empresa é
--    deletada.
