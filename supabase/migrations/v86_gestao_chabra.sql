-- V86 — Gestão Chabra: quadros (projetos) e tarefas (Kanban)

create table if not exists public.gestao_quadros (
  id_quadro text primary key,
  nome text not null,
  descricao text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.gestao_tarefas (
  id_tarefa text primary key,
  id_quadro text not null references public.gestao_quadros(id_quadro) on delete cascade,
  titulo text not null,
  descricao text,
  status text not null default 'A_FAZER',     -- A_FAZER | EM_ANDAMENTO | EM_REVISAO | CONCLUIDO
  prioridade text not null default 'Media',   -- Baixa | Media | Alta | Urgente
  responsavel text,
  prazo date,
  ordem integer not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists idx_gestao_tarefas_quadro on public.gestao_tarefas (id_quadro);
create index if not exists idx_gestao_tarefas_status on public.gestao_tarefas (status);

alter table public.gestao_quadros enable row level security;
alter table public.gestao_tarefas enable row level security;

drop policy if exists gestao_quadros_sel on public.gestao_quadros;
create policy gestao_quadros_sel on public.gestao_quadros for select to authenticated using (true);
drop policy if exists gestao_quadros_wr on public.gestao_quadros;
create policy gestao_quadros_wr on public.gestao_quadros for all to authenticated
  using (public.caller_pode_editar()) with check (public.caller_pode_editar());

drop policy if exists gestao_tarefas_sel on public.gestao_tarefas;
create policy gestao_tarefas_sel on public.gestao_tarefas for select to authenticated using (true);
drop policy if exists gestao_tarefas_wr on public.gestao_tarefas;
create policy gestao_tarefas_wr on public.gestao_tarefas for all to authenticated
  using (public.caller_pode_editar()) with check (public.caller_pode_editar());

-- Quadro padrão da equipe.
insert into public.gestao_quadros (id_quadro, nome, descricao)
values ('QDR-GERAL01', 'Geral', 'Quadro principal de tarefas da equipe')
on conflict (id_quadro) do nothing;
