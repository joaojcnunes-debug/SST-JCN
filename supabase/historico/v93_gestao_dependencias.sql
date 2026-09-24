-- V93 — Gestão Chabra: dependências entre tarefas ("id_tarefa depende de depende_de")

create table if not exists public.gestao_dependencias (
  id uuid primary key,
  id_tarefa  text not null references public.gestao_tarefas(id_tarefa) on delete cascade, -- depende de…
  depende_de text not null references public.gestao_tarefas(id_tarefa) on delete cascade, -- …esta
  created_at timestamptz not null default now(),
  unique (id_tarefa, depende_de),
  check (id_tarefa <> depende_de)
);
create index if not exists idx_gestao_dep_tarefa on public.gestao_dependencias (id_tarefa);
create index if not exists idx_gestao_dep_dependede on public.gestao_dependencias (depende_de);

alter table public.gestao_dependencias enable row level security;
drop policy if exists gestao_dep_sel on public.gestao_dependencias;
create policy gestao_dep_sel on public.gestao_dependencias for select to authenticated using (true);
drop policy if exists gestao_dep_wr on public.gestao_dependencias;
create policy gestao_dep_wr on public.gestao_dependencias for all to authenticated
  using (public.caller_pode_editar()) with check (public.caller_pode_editar());

-- Anti-ciclo: rejeita se depende_de já depende (transitivamente) de id_tarefa
create or replace function public.gestao_dep_no_cycle() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if exists (
    with recursive cadeia as (
      select new.depende_de as t
      union all
      select d.depende_de from public.gestao_dependencias d join cadeia c on d.id_tarefa = c.t
    ) select 1 from cadeia where t = new.id_tarefa
  ) then raise exception 'Dependencia circular nao permitida'; end if;
  return new;
end $$;
drop trigger if exists trg_gestao_dep_no_cycle on public.gestao_dependencias;
create trigger trg_gestao_dep_no_cycle before insert on public.gestao_dependencias
  for each row execute function public.gestao_dep_no_cycle();
