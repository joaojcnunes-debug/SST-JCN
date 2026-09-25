-- v262 — Fonte geradora do risco como lista de múltipla seleção (DRPS e QPS).
--
-- Pedido em 2026-09-25: na tela de Análise, a coluna "Fontes Geradoras do
-- Risco" vira uma lista suspensa de múltipla escolha, por setor, e aceita
-- fontes novas digitadas (cada vírgula = uma fonte). Fonte nova vira opção
-- para TODOS os relatórios (catálogo por tópico/categoria).
--
--   · drps_relatorios.fontes_por_setor  {setor: {topico_idx: [fontes]}}
--   · qps_aplicacoes.fontes_por_setor   {setor|"*": {id_categoria: [fontes]}}
--     Tópico/categoria ausente no mapa = as fontes PADRÃO (texto do tópico no
--     DRPS / qps_categorias.fonte_geradora no QPS). Assim laudos existentes
--     saem idênticos até alguém mexer.
--   · psi_fontes_geradoras: catálogo das fontes digitadas.
--       modulo 'drps' → chave = índice do tópico (0..12)
--       modulo 'qps'  → chave = id_categoria
--
-- Rollback: scripts/sql/v262_rollback_fontes_geradoras_selecao.sql

begin;

alter table public.drps_relatorios
  add column if not exists fontes_por_setor jsonb not null default '{}'::jsonb;
alter table public.qps_aplicacoes
  add column if not exists fontes_por_setor jsonb not null default '{}'::jsonb;

comment on column public.drps_relatorios.fontes_por_setor is
  'Fontes geradoras escolhidas: {setor: {topico_idx: [texto]}}. Ausente = padrão do tópico (v262).';
comment on column public.qps_aplicacoes.fontes_por_setor is
  'Fontes geradoras escolhidas: {setor|"*": {id_categoria: [texto]}}. Ausente = fonte_geradora da categoria (v262).';

create table if not exists public.psi_fontes_geradoras (
  id          uuid primary key default gen_random_uuid(),
  modulo      text not null check (modulo in ('drps', 'qps')),
  chave       text not null,
  texto       text not null check (length(trim(texto)) > 0),
  criado_por  text default lower(auth.jwt() ->> 'email'),
  criado_em   timestamptz not null default now()
);

create unique index if not exists psi_fontes_geradoras_uq
  on public.psi_fontes_geradoras (modulo, chave, lower(trim(texto)));

comment on table public.psi_fontes_geradoras is
  'Catálogo de fontes geradoras digitadas na Análise do DRPS/QPS; viram opção para todos (v262).';

alter table public.psi_fontes_geradoras enable row level security;

drop policy if exists psi_fontes_ler on public.psi_fontes_geradoras;
create policy psi_fontes_ler on public.psi_fontes_geradoras
  for select to authenticated using (true);

drop policy if exists psi_fontes_inserir on public.psi_fontes_geradoras;
create policy psi_fontes_inserir on public.psi_fontes_geradoras
  for insert to authenticated with check (public.caller_pode_editar());

drop policy if exists psi_fontes_excluir on public.psi_fontes_geradoras;
create policy psi_fontes_excluir on public.psi_fontes_geradoras
  for delete to authenticated using (public.caller_eh_admin());

grant select, insert, delete on public.psi_fontes_geradoras to authenticated;

commit;
