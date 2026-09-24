-- ============================================================
-- V10: PAE — Plano de Ação e Emergência (contatos hierárquicos)
-- ============================================================
-- Cada inspeção pode ter sua própria árvore de contatos pra plano
-- de emergência: nome, cargo e telefone, com hierarquia (cada
-- contato pode ter um pai/superior). Self-FK em id_parent.
-- Idempotente.
-- ============================================================

create table if not exists public.pae_contatos (
  id_contato   text primary key,
  id_inspecao  text not null references public.inspecoes(id_inspecao) on delete cascade,
  id_empresa   text not null references public.empresas(id_empresa) on delete cascade,
  id_parent    text references public.pae_contatos(id_contato) on delete cascade,
  nome         text not null,
  cargo        text,
  telefone     text,
  ordem        int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz
);

create index if not exists idx_pae_inspecao
  on public.pae_contatos (id_inspecao, ordem);

create index if not exists idx_pae_parent
  on public.pae_contatos (id_parent) where id_parent is not null;

alter table public.pae_contatos enable row level security;

drop policy if exists "auth read pae_contatos" on public.pae_contatos;
create policy "auth read pae_contatos"
  on public.pae_contatos for select
  to authenticated using (true);

drop policy if exists "auth write pae_contatos" on public.pae_contatos;
create policy "auth write pae_contatos"
  on public.pae_contatos for all
  to authenticated using (true) with check (true);
