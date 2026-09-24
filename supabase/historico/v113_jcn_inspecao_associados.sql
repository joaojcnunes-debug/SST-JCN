-- v113 (JCN) — Associados à elaboração de inspeção (Documento SGG). Reflexo do painel v114.
-- Aplicado via MCP supabase-sst. Vários usuários podem se associar; admin pode associar
-- outros. Aditivo, convive com o fluxo de status (elaboracao_status/responsavel) de inspecoes.
create table if not exists public.inspecao_associados (
  id            text primary key,
  id_inspecao   text not null references public.inspecoes(id_inspecao) on delete cascade,
  id_usuario    text not null,
  nome          text not null,
  created_by    text,
  created_at    timestamptz not null default now(),
  unique (id_inspecao, id_usuario)
);
create index if not exists idx_inspecao_associados_insp on public.inspecao_associados (id_inspecao);
alter table public.inspecao_associados enable row level security;
drop policy if exists "auth read inspecao_associados" on public.inspecao_associados;
create policy "auth read inspecao_associados"
  on public.inspecao_associados for select to authenticated using (true);
drop policy if exists "auth write inspecao_associados" on public.inspecao_associados;
create policy "auth write inspecao_associados"
  on public.inspecao_associados for all to authenticated using (true) with check (true);
