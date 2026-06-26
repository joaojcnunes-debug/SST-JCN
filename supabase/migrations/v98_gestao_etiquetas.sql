-- V98 — Gestão Chabra: catálogo de etiquetas (nome + cor) por quadro
-- As tarefas continuam guardando os NOMES em gestao_tarefas.etiquetas (text[]);
-- este catálogo dá cor/ordem a cada etiqueta (lookup por nome).

create table if not exists public.gestao_etiquetas (
  id uuid primary key,
  id_quadro text not null references public.gestao_quadros(id_quadro) on delete cascade,
  nome text not null,
  cor text not null default '#94a3b8',
  ordem int not null default 0,
  unique (id_quadro, nome)
);
create index if not exists idx_gestao_etiquetas_quadro on public.gestao_etiquetas (id_quadro);

alter table public.gestao_etiquetas enable row level security;
drop policy if exists gestao_etiq_sel on public.gestao_etiquetas;
create policy gestao_etiq_sel on public.gestao_etiquetas for select to authenticated using (true);
drop policy if exists gestao_etiq_wr on public.gestao_etiquetas;
create policy gestao_etiq_wr on public.gestao_etiquetas for all to authenticated
  using (public.caller_pode_editar()) with check (public.caller_pode_editar());
