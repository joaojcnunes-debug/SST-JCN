-- V92 — Gestão Chabra: hierarquia Espaço → Pasta → Lista (Quadro)

create table if not exists public.gestao_espacos (
  id uuid primary key, nome text not null, cor text not null default '#006B54',
  ordem int not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.gestao_pastas (
  id uuid primary key,
  id_espaco uuid not null references public.gestao_espacos(id) on delete cascade,
  nome text not null, ordem int not null default 0, created_at timestamptz not null default now()
);
create index if not exists idx_gestao_pastas_espaco on public.gestao_pastas (id_espaco);

-- Quadros (Listas) passam a pertencer a um Espaço e (opcionalmente) a uma Pasta
alter table public.gestao_quadros
  add column if not exists id_espaco uuid references public.gestao_espacos(id) on delete set null,
  add column if not exists id_pasta  uuid references public.gestao_pastas(id)  on delete set null,
  add column if not exists ordem int not null default 0;

alter table public.gestao_espacos enable row level security;
alter table public.gestao_pastas  enable row level security;
drop policy if exists gestao_espacos_sel on public.gestao_espacos;
create policy gestao_espacos_sel on public.gestao_espacos for select to authenticated using (true);
drop policy if exists gestao_espacos_wr on public.gestao_espacos;
create policy gestao_espacos_wr on public.gestao_espacos for all to authenticated using (public.caller_pode_editar()) with check (public.caller_pode_editar());
drop policy if exists gestao_pastas_sel on public.gestao_pastas;
create policy gestao_pastas_sel on public.gestao_pastas for select to authenticated using (true);
drop policy if exists gestao_pastas_wr on public.gestao_pastas;
create policy gestao_pastas_wr on public.gestao_pastas for all to authenticated using (public.caller_pode_editar()) with check (public.caller_pode_editar());

-- Backfill: Espaço + Pasta "Geral" e atribuição dos quadros existentes
do $$ declare e uuid := gen_random_uuid(); p uuid := gen_random_uuid(); begin
  insert into public.gestao_espacos (id,nome,ordem) values (e,'Geral',0);
  insert into public.gestao_pastas  (id,id_espaco,nome,ordem) values (p,e,'Geral',0);
  update public.gestao_quadros set id_espaco=e, id_pasta=p where id_espaco is null;
end $$;
