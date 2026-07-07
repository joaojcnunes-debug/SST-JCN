-- v111 (JCN) — Catálogo configurável do Plano de Ação (DRPS): "O Quê" (pai) -> "Como" (filho). Global.
-- Reflexo do painel-sst v104_drps_acao_catalogo. Aplicado via MCP supabase-sst.
-- Padrão dos catálogos drps_agravos/drps_medidas_recomendadas
-- (RLS: leitura authenticated, escrita caller_pode_editar).
create table if not exists public.drps_acao_oque (
  id text primary key default gen_random_uuid()::text,
  titulo text not null,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create table if not exists public.drps_acao_como (
  id text primary key default gen_random_uuid()::text,
  id_oque text not null references public.drps_acao_oque(id) on delete cascade,
  titulo text not null,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists idx_drps_acao_como_oque on public.drps_acao_como (id_oque);

alter table public.drps_acao_oque enable row level security;
alter table public.drps_acao_como enable row level security;
create policy "auth read drps_acao_oque" on public.drps_acao_oque for select to authenticated using (true);
create policy drps_acao_oque_rw on public.drps_acao_oque for all to authenticated using (public.caller_pode_editar()) with check (public.caller_pode_editar());
create policy "auth read drps_acao_como" on public.drps_acao_como for select to authenticated using (true);
create policy drps_acao_como_rw on public.drps_acao_como for all to authenticated using (public.caller_pode_editar()) with check (public.caller_pode_editar());
