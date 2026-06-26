-- V88 — Gestão Chabra: comentários nas tarefas
create table if not exists public.gestao_comentarios (
  id_comentario text primary key,
  id_tarefa text not null references public.gestao_tarefas(id_tarefa) on delete cascade,
  autor text,
  texto text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_gestao_coment_tarefa on public.gestao_comentarios (id_tarefa);

alter table public.gestao_comentarios enable row level security;
drop policy if exists gestao_coment_sel on public.gestao_comentarios;
create policy gestao_coment_sel on public.gestao_comentarios for select to authenticated using (true);
drop policy if exists gestao_coment_wr on public.gestao_comentarios;
create policy gestao_coment_wr on public.gestao_comentarios for all to authenticated
  using (public.caller_pode_editar()) with check (public.caller_pode_editar());
