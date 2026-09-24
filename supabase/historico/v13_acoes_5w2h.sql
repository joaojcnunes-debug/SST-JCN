-- ============================================================
-- V13: Plano de Ação — Tabela 5W2H
-- ============================================================
-- Centraliza todas as ações/tratativas que precisam ser executadas
-- pelas empresas. Cada ação segue a metodologia 5W2H e pode ser
-- direcionada a: empresa (obrigatório), setor (opcional), risco
-- (opcional), inspeção origem (opcional).
--
-- Idempotente.
-- ============================================================

create table if not exists public.acoes_5w2h (
  id_acao            text primary key,
  id_empresa         text not null references public.empresas(id_empresa) on delete cascade,
  id_setor           text references public.setores(id_setor) on delete set null,
  id_risco           text references public.riscos(id_risco) on delete set null,
  id_inspecao        text references public.inspecoes(id_inspecao) on delete set null,

  -- 5W2H
  what_acao          text not null,         -- O quê: descrição da ação
  why_justificativa  text,                  -- Por quê: motivo/justificativa
  where_local        text,                  -- Onde: local específico
  when_prazo         date,                  -- Quando: prazo de execução
  who_responsavel    text,                  -- Quem: responsável pela ação
  how_metodo         text,                  -- Como: método/procedimento
  how_much_custo     text,                  -- Quanto: estimativa de custo

  -- Gestão
  status             text not null default 'Pendente'
                     check (status in ('Pendente','Em Andamento','Concluida','Cancelada')),
  prioridade         text not null default 'Media'
                     check (prioridade in ('Baixa','Media','Alta','Critica')),
  data_conclusao     date,
  observacoes        text,

  created_by         text,                  -- email de quem criou
  created_at         timestamptz not null default now(),
  updated_at         timestamptz
);

create index if not exists idx_acoes_empresa
  on public.acoes_5w2h (id_empresa, status);

create index if not exists idx_acoes_setor
  on public.acoes_5w2h (id_setor) where id_setor is not null;

create index if not exists idx_acoes_risco
  on public.acoes_5w2h (id_risco) where id_risco is not null;

create index if not exists idx_acoes_inspecao
  on public.acoes_5w2h (id_inspecao) where id_inspecao is not null;

create index if not exists idx_acoes_prazo
  on public.acoes_5w2h (when_prazo) where when_prazo is not null;

alter table public.acoes_5w2h enable row level security;

drop policy if exists "auth read acoes_5w2h" on public.acoes_5w2h;
create policy "auth read acoes_5w2h"
  on public.acoes_5w2h for select to authenticated using (true);

drop policy if exists "auth write acoes_5w2h" on public.acoes_5w2h;
create policy "auth write acoes_5w2h"
  on public.acoes_5w2h for all to authenticated using (true) with check (true);
