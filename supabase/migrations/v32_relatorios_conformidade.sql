-- V32 — Módulo "Relatório de Conformidade NR"
--
-- Sistema de checklists por Norma Regulamentadora. Cada relatório vincula
-- uma NR a uma empresa+setor e contém itens marcáveis (Conforme / Não Aplicável /
-- Pendente) com observações livres.
--
-- O CATÁLOGO de NRs e itens fica em `lib/conformidade/checklists.ts` (estático
-- no código) — não tem tabela própria pra isso. Cada item do checklist é
-- copiado pra `relatorios_conformidade_itens` no momento da criação do
-- relatório, pra que mudanças futuras no catálogo não alterem relatórios
-- já emitidos (snapshot da norma na data da auditoria).

create table if not exists public.relatorios_conformidade (
  id_relatorio          text primary key,
  id_empresa            text not null references public.empresas(id_empresa) on delete cascade,

  -- Norma auditada (snapshot — código e título vêm do catálogo no momento da criação)
  nr_codigo             text not null,        -- "NR-24"
  nr_titulo             text not null,        -- "Condições Sanitárias e de Conforto..."

  -- Escopo da auditoria
  setor                 text,                 -- texto livre (ou seleciona depois)
  responsavel           text,                 -- nome do responsável técnico
  data_inspecao         date,
  observacoes_gerais    text,

  -- Status
  status                text not null default 'RASCUNHO'
                          check (status in ('RASCUNHO', 'FINALIZADO')),
  finalizado_em         timestamptz,

  -- Auditoria
  usuario_email         text,
  usuario_nome          text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz
);

create index if not exists idx_relatorios_conformidade_empresa
  on public.relatorios_conformidade (id_empresa, created_at desc);

create index if not exists idx_relatorios_conformidade_nr
  on public.relatorios_conformidade (nr_codigo);

create index if not exists idx_relatorios_conformidade_created
  on public.relatorios_conformidade (created_at desc);

alter table public.relatorios_conformidade enable row level security;

drop policy if exists "auth read relatorios_conformidade"
  on public.relatorios_conformidade;
create policy "auth read relatorios_conformidade"
  on public.relatorios_conformidade for select to authenticated using (true);

drop policy if exists "auth write relatorios_conformidade"
  on public.relatorios_conformidade;
create policy "auth write relatorios_conformidade"
  on public.relatorios_conformidade for all to authenticated
  using (true) with check (true);

-- Itens do relatório (snapshot dos itens do catálogo da NR no momento da criação)
create table if not exists public.relatorios_conformidade_itens (
  id_item               text primary key,
  id_relatorio          text not null references public.relatorios_conformidade(id_relatorio)
                          on delete cascade,

  -- Snapshot do item do catálogo
  item_codigo           text not null,        -- "24.1.1"
  item_titulo           text not null,
  item_descricao        text,
  ordem                 integer not null default 0,

  -- Avaliação
  situacao              text not null default 'PENDENTE'
                          check (situacao in ('CONFORME', 'NAO_APLICAVEL', 'PENDENTE')),
  observacao            text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz
);

create index if not exists idx_relatorios_conformidade_itens_relatorio
  on public.relatorios_conformidade_itens (id_relatorio, ordem);

alter table public.relatorios_conformidade_itens enable row level security;

drop policy if exists "auth read relatorios_conformidade_itens"
  on public.relatorios_conformidade_itens;
create policy "auth read relatorios_conformidade_itens"
  on public.relatorios_conformidade_itens for select to authenticated using (true);

drop policy if exists "auth write relatorios_conformidade_itens"
  on public.relatorios_conformidade_itens;
create policy "auth write relatorios_conformidade_itens"
  on public.relatorios_conformidade_itens for all to authenticated
  using (true) with check (true);
