-- V90 — Gestão Chabra: status customizáveis por quadro
-- Mantém gestao_tarefas.status como slug TEXT; semeia 4 defaults por quadro.

create table if not exists public.gestao_status (
  id uuid primary key,
  id_quadro text not null references public.gestao_quadros(id_quadro) on delete cascade,
  slug text not null,                  -- estável; referenciado por gestao_tarefas.status
  nome text not null,
  cor text not null default '#94a3b8',
  ordem int not null default 0,
  tipo text not null default 'ativo',  -- nao_iniciado | ativo | concluido
  unique (id_quadro, slug)
);
create index if not exists idx_gestao_status_quadro on public.gestao_status (id_quadro);

alter table public.gestao_status enable row level security;
drop policy if exists gestao_status_sel on public.gestao_status;
create policy gestao_status_sel on public.gestao_status for select to authenticated using (true);
drop policy if exists gestao_status_wr on public.gestao_status;
create policy gestao_status_wr on public.gestao_status for all to authenticated
  using (public.caller_pode_editar()) with check (public.caller_pode_editar());

-- Backfill: 4 defaults para cada quadro existente (preserva tarefas; slugs atuais)
insert into public.gestao_status (id, id_quadro, slug, nome, cor, ordem, tipo)
select gen_random_uuid(), q.id_quadro, d.slug, d.nome, d.cor, d.ordem, d.tipo
from public.gestao_quadros q
cross join (values
  ('A_FAZER','A fazer','#94a3b8',0,'nao_iniciado'),
  ('EM_ANDAMENTO','Em andamento','#f59e0b',1,'ativo'),
  ('EM_REVISAO','Em revisão','#6366f1',2,'ativo'),
  ('CONCLUIDO','Concluído','#16a34a',3,'concluido')
) as d(slug,nome,cor,ordem,tipo)
on conflict (id_quadro, slug) do nothing;

-- Trigger: semeia os 4 defaults ao criar um quadro novo
create or replace function public.gestao_seed_status() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.gestao_status (id, id_quadro, slug, nome, cor, ordem, tipo) values
    (gen_random_uuid(), new.id_quadro, 'A_FAZER','A fazer','#94a3b8',0,'nao_iniciado'),
    (gen_random_uuid(), new.id_quadro, 'EM_ANDAMENTO','Em andamento','#f59e0b',1,'ativo'),
    (gen_random_uuid(), new.id_quadro, 'EM_REVISAO','Em revisão','#6366f1',2,'ativo'),
    (gen_random_uuid(), new.id_quadro, 'CONCLUIDO','Concluído','#16a34a',3,'concluido')
  on conflict (id_quadro, slug) do nothing;
  return new;
end $$;
drop trigger if exists trg_gestao_seed_status on public.gestao_quadros;
create trigger trg_gestao_seed_status after insert on public.gestao_quadros
  for each row execute function public.gestao_seed_status();
