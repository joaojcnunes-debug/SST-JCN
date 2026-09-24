-- V91 — Gestão Chabra: campos personalizados por quadro (definições) + valores na tarefa (JSONB)

create table if not exists public.gestao_campos (
  id uuid primary key,
  id_quadro text not null references public.gestao_quadros(id_quadro) on delete cascade,
  nome text not null,
  tipo text not null,                         -- texto|numero|data|selecao|multi|checkbox|moeda|url
  opcoes text[] not null default '{}',        -- para selecao|multi
  ordem int not null default 0,
  visivel_cliente boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_gestao_campos_quadro on public.gestao_campos (id_quadro);

alter table public.gestao_campos enable row level security;
drop policy if exists gestao_campos_sel on public.gestao_campos;
create policy gestao_campos_sel on public.gestao_campos for select to authenticated using (true);
drop policy if exists gestao_campos_wr on public.gestao_campos;
create policy gestao_campos_wr on public.gestao_campos for all to authenticated
  using (public.caller_pode_editar()) with check (public.caller_pode_editar());

-- Valores dos campos: { "<campo_id>": valor, ... } na própria tarefa
alter table public.gestao_tarefas
  add column if not exists campos jsonb not null default '{}'::jsonb;
