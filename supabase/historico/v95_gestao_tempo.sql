-- V95 — Gestão Chabra: time-tracking + log imutável de atividades

create table if not exists public.gestao_tempo (
  id uuid primary key,
  id_tarefa text not null references public.gestao_tarefas(id_tarefa) on delete cascade,
  usuario_email text not null,
  inicio timestamptz not null,
  fim timestamptz,                              -- null = rodando
  segundos int,                                 -- preenchido ao parar/manual
  manual boolean not null default false,
  descricao text,
  created_at timestamptz not null default now()
);
create index if not exists idx_gestao_tempo_tarefa on public.gestao_tempo (id_tarefa);
create index if not exists idx_gestao_tempo_user on public.gestao_tempo (usuario_email, fim);

alter table public.gestao_tempo enable row level security;
drop policy if exists gestao_tempo_sel on public.gestao_tempo;
create policy gestao_tempo_sel on public.gestao_tempo for select to authenticated using (true);
drop policy if exists gestao_tempo_wr on public.gestao_tempo;
create policy gestao_tempo_wr on public.gestao_tempo for all to authenticated using (public.caller_pode_editar()) with check (public.caller_pode_editar());

-- Log imutável (apenas select + insert; sem update/delete = imutável sob RLS)
create table if not exists public.gestao_atividades (
  id uuid primary key,
  ator text,
  acao text not null,
  id_tarefa text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_gestao_atividades_tarefa on public.gestao_atividades (id_tarefa);
alter table public.gestao_atividades enable row level security;
drop policy if exists gestao_ativ_sel on public.gestao_atividades;
create policy gestao_ativ_sel on public.gestao_atividades for select to authenticated using (true);
drop policy if exists gestao_ativ_ins on public.gestao_atividades;
create policy gestao_ativ_ins on public.gestao_atividades for insert to authenticated with check (public.caller_pode_editar());
