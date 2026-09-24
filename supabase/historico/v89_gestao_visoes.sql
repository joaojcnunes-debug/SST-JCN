-- V89 — Gestão Chabra: campo data_inicio (Gantt) + preferência de visão por usuário/quadro

-- 1) Campo de início para a Timeline/Gantt (nullable; degrada para marcador no prazo)
alter table public.gestao_tarefas
  add column if not exists data_inicio date;

-- 2) Preferência de visão por usuário + quadro (UUID client-generated PK)
create table if not exists public.gestao_preferencias_visao (
  id uuid primary key,
  usuario_email text not null,
  id_quadro text not null references public.gestao_quadros(id_quadro) on delete cascade,
  vista text not null default 'quadro',     -- quadro | lista | calendario | timeline
  agrupar_por text,                          -- status | responsavel | prioridade | etiqueta
  config jsonb not null default '{}'::jsonb, -- ordenação/visibilidade de colunas, etc.
  updated_at timestamptz not null default now(),
  unique (usuario_email, id_quadro)
);

alter table public.gestao_preferencias_visao enable row level security;

drop policy if exists gestao_pref_sel on public.gestao_preferencias_visao;
create policy gestao_pref_sel on public.gestao_preferencias_visao
  for select to authenticated
  using (lower(usuario_email) = lower(auth.jwt() ->> 'email'));

drop policy if exists gestao_pref_wr on public.gestao_preferencias_visao;
create policy gestao_pref_wr on public.gestao_preferencias_visao
  for all to authenticated
  using (lower(usuario_email) = lower(auth.jwt() ->> 'email'))
  with check (lower(usuario_email) = lower(auth.jwt() ->> 'email'));
