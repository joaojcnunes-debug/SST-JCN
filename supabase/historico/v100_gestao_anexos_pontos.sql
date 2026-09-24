-- Fase 11a — Anexos no card (Storage, bucket 'anexos') + Pontos/esforço.
create table if not exists public.gestao_anexos (
  id uuid primary key,
  id_tarefa text not null references public.gestao_tarefas(id_tarefa) on delete cascade,
  nome text not null,
  storage_path text not null,
  mime text,
  tamanho_bytes int,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists idx_gestao_anexos_tarefa on public.gestao_anexos (id_tarefa);
alter table public.gestao_anexos enable row level security;
create policy gestao_anexos_sel on public.gestao_anexos for select to authenticated using (true);
create policy gestao_anexos_wr on public.gestao_anexos for all to authenticated using (public.caller_pode_editar()) with check (public.caller_pode_editar());

alter table public.gestao_tarefas add column if not exists pontos int;
