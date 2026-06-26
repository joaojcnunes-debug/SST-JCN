-- V96 — Gestão Chabra: automações por quadro ("quando X então Y")

create table if not exists public.gestao_automacoes (
  id uuid primary key,
  id_quadro text not null references public.gestao_quadros(id_quadro) on delete cascade,
  nome text not null,
  ativo boolean not null default true,
  gatilho text not null,                        -- status_muda | tarefa_criada | prazo_proximo
  condicao jsonb not null default '{}'::jsonb,   -- ex: {de:'A_FAZER', para:'CONCLUIDO'}
  acao jsonb not null default '{}'::jsonb,        -- ex: {tipo:'definir_responsavel', valor:'Fulano'}
  ordem int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_gestao_automacoes_quadro on public.gestao_automacoes (id_quadro);

alter table public.gestao_automacoes enable row level security;
drop policy if exists gestao_autom_sel on public.gestao_automacoes;
create policy gestao_autom_sel on public.gestao_automacoes for select to authenticated using (true);
drop policy if exists gestao_autom_wr on public.gestao_automacoes;
create policy gestao_autom_wr on public.gestao_automacoes for all to authenticated using (public.caller_pode_editar()) with check (public.caller_pode_editar());
