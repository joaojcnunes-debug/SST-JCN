-- V99 — Gestão Chabra: filtros salvos por usuário e quadro

create table if not exists public.gestao_filtros_salvos (
  id uuid primary key,
  usuario_email text not null,
  id_quadro text not null references public.gestao_quadros(id_quadro) on delete cascade,
  nome text not null,
  criterios jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_gestao_filtros_user on public.gestao_filtros_salvos (usuario_email, id_quadro);

alter table public.gestao_filtros_salvos enable row level security;
drop policy if exists gestao_filtros_sel on public.gestao_filtros_salvos;
create policy gestao_filtros_sel on public.gestao_filtros_salvos for select to authenticated using (lower(usuario_email)=lower(auth.jwt()->>'email'));
drop policy if exists gestao_filtros_wr on public.gestao_filtros_salvos;
create policy gestao_filtros_wr on public.gestao_filtros_salvos for all to authenticated using (lower(usuario_email)=lower(auth.jwt()->>'email')) with check (lower(usuario_email)=lower(auth.jwt()->>'email'));
