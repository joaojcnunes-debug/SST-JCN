-- ============================================================
-- V17: DRPS — Diagnóstico de Riscos Psicossociais (NR-01)
-- ============================================================
-- Suporta importação de respostas do Forms (1 linha por respondente),
-- cálculo de gravidade por tópico (média das pontuações corrigidas)
-- e probabilidade editável pelo psicólogo por empresa × setor × tópico.
--
-- A matriz de risco final é calculada em runtime (não persistida).
-- Idempotente.
-- ============================================================

-- 1) Respondentes — 1 linha por pessoa que respondeu o Forms.
create table if not exists public.drps_respondentes (
  id_respondente   uuid primary key default gen_random_uuid(),
  id_empresa       text not null references public.empresas(id_empresa) on delete cascade,
  setor            text not null,
  cargo            text,
  -- 90 respostas inteiras 0..4 (9 tópicos × 10 perguntas, na ordem do spec).
  -- O range 0..4 é garantido pelo parser do app (lib/drps/calculos.ts) que
  -- clipa via Math.max(0, Math.min(4, v)). Não usamos CHECK com unnest()
  -- porque Postgres não permite subqueries em check constraints.
  respostas        smallint[] not null,
  data_carimbo     timestamptz,
  importado_em     timestamptz not null default now(),
  -- agrupa importações para permitir "limpar última importação" e auditoria
  lote_importacao  uuid not null default gen_random_uuid(),
  constraint drps_resp_tam check (cardinality(respostas) = 90)
);

create index if not exists idx_drps_resp_empresa
  on public.drps_respondentes (id_empresa);

create index if not exists idx_drps_resp_setor
  on public.drps_respondentes (id_empresa, setor);

create index if not exists idx_drps_resp_lote
  on public.drps_respondentes (lote_importacao);

alter table public.drps_respondentes enable row level security;

drop policy if exists "auth read drps_respondentes" on public.drps_respondentes;
create policy "auth read drps_respondentes"
  on public.drps_respondentes for select to authenticated using (true);

drop policy if exists "auth write drps_respondentes" on public.drps_respondentes;
create policy "auth write drps_respondentes"
  on public.drps_respondentes for all to authenticated using (true) with check (true);


-- 2) Probabilidades — definidas pelo psicólogo por empresa×setor×tópico.
--    topico_idx: 0..8 conforme TOPICOS em lib/drps/topicos.ts
--    probabilidade: 1=Baixa, 2=Média, 3=Alta
create table if not exists public.drps_probabilidades (
  id_empresa     text not null references public.empresas(id_empresa) on delete cascade,
  setor          text not null,
  topico_idx     smallint not null check (topico_idx between 0 and 8),
  probabilidade  smallint not null check (probabilidade between 1 and 3),
  updated_at     timestamptz not null default now(),
  primary key (id_empresa, setor, topico_idx)
);

create index if not exists idx_drps_prob_empresa
  on public.drps_probabilidades (id_empresa);

alter table public.drps_probabilidades enable row level security;

drop policy if exists "auth read drps_probabilidades" on public.drps_probabilidades;
create policy "auth read drps_probabilidades"
  on public.drps_probabilidades for select to authenticated using (true);

drop policy if exists "auth write drps_probabilidades" on public.drps_probabilidades;
create policy "auth write drps_probabilidades"
  on public.drps_probabilidades for all to authenticated using (true) with check (true);
