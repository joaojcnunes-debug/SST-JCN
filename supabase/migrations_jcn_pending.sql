-- === v11_treinamentos_nr.sql ===
-- ============================================================
-- V11: Treinamentos NR — direcionados por setor, cargo e/ou risco
-- ============================================================
-- Cada inspeção pode ter sua lista de treinamentos obrigatórios
-- (geralmente NRs). Cada treinamento pode ser aplicado a um ou
-- mais setores, cargos e/ou riscos (relacionamentos M:N).
-- Idempotente.
-- ============================================================

-- 1) TREINAMENTOS_NR ----------------------------------------------
create table if not exists public.treinamentos_nr (
  id_treinamento  text primary key,
  id_inspecao     text not null references public.inspecoes(id_inspecao) on delete cascade,
  id_empresa      text not null references public.empresas(id_empresa) on delete cascade,
  nr              text not null,
  titulo          text not null,
  descricao       text,
  carga_horaria   text,
  periodicidade   text,
  observacoes     text,
  ordem           int  not null default 0,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz
);

create index if not exists idx_treinamentos_inspecao
  on public.treinamentos_nr (id_inspecao, ordem);

alter table public.treinamentos_nr enable row level security;

drop policy if exists "auth read treinamentos_nr" on public.treinamentos_nr;
create policy "auth read treinamentos_nr"
  on public.treinamentos_nr for select to authenticated using (true);

drop policy if exists "auth write treinamentos_nr" on public.treinamentos_nr;
create policy "auth write treinamentos_nr"
  on public.treinamentos_nr for all to authenticated using (true) with check (true);


-- 2) TREINAMENTOS_SETOR (M:N) -------------------------------------
create table if not exists public.treinamentos_setor (
  id_treinamento text not null references public.treinamentos_nr(id_treinamento) on delete cascade,
  id_setor       text not null references public.setores(id_setor) on delete cascade,
  primary key (id_treinamento, id_setor)
);

alter table public.treinamentos_setor enable row level security;

drop policy if exists "auth read treinamentos_setor" on public.treinamentos_setor;
create policy "auth read treinamentos_setor"
  on public.treinamentos_setor for select to authenticated using (true);

drop policy if exists "auth write treinamentos_setor" on public.treinamentos_setor;
create policy "auth write treinamentos_setor"
  on public.treinamentos_setor for all to authenticated using (true) with check (true);


-- 3) TREINAMENTOS_CARGO (M:N) -------------------------------------
create table if not exists public.treinamentos_cargo (
  id_treinamento text not null references public.treinamentos_nr(id_treinamento) on delete cascade,
  id_cargo       text not null references public.cargos(id_cargo) on delete cascade,
  primary key (id_treinamento, id_cargo)
);

alter table public.treinamentos_cargo enable row level security;

drop policy if exists "auth read treinamentos_cargo" on public.treinamentos_cargo;
create policy "auth read treinamentos_cargo"
  on public.treinamentos_cargo for select to authenticated using (true);

drop policy if exists "auth write treinamentos_cargo" on public.treinamentos_cargo;
create policy "auth write treinamentos_cargo"
  on public.treinamentos_cargo for all to authenticated using (true) with check (true);


-- 4) TREINAMENTOS_RISCO (M:N) -------------------------------------
create table if not exists public.treinamentos_risco (
  id_treinamento text not null references public.treinamentos_nr(id_treinamento) on delete cascade,
  id_risco       text not null references public.riscos(id_risco) on delete cascade,
  primary key (id_treinamento, id_risco)
);

alter table public.treinamentos_risco enable row level security;

drop policy if exists "auth read treinamentos_risco" on public.treinamentos_risco;
create policy "auth read treinamentos_risco"
  on public.treinamentos_risco for select to authenticated using (true);

drop policy if exists "auth write treinamentos_risco" on public.treinamentos_risco;
create policy "auth write treinamentos_risco"
  on public.treinamentos_risco for all to authenticated using (true) with check (true);


-- === v16_modulos_maquinas.sql ===
-- V16 — Adiciona módulos Apreciação de Máquinas e Inventário de Máquinas
--
-- Estende a coluna modulos_permitidos para incluir 'apreciacao_maquinas' e
-- 'inventario_maquinas'. Atualiza o DEFAULT e propaga para usuários
-- existentes (sem duplicar).

-- 1) Atualiza o DEFAULT da coluna
ALTER TABLE public.usuarios
  ALTER COLUMN modulos_permitidos
  SET DEFAULT ARRAY[
    'painel',
    'psicossocial',
    'conformidade',
    'nao_conformidade',
    'apreciacao_maquinas',
    'inventario_maquinas'
  ]::text[];

-- 2) Adiciona 'apreciacao_maquinas' para quem ainda não tem
UPDATE public.usuarios
   SET modulos_permitidos =
       modulos_permitidos || ARRAY['apreciacao_maquinas']::text[]
 WHERE NOT (modulos_permitidos @> ARRAY['apreciacao_maquinas']::text[]);

-- 3) Adiciona 'inventario_maquinas' para quem ainda não tem
UPDATE public.usuarios
   SET modulos_permitidos =
       modulos_permitidos || ARRAY['inventario_maquinas']::text[]
 WHERE NOT (modulos_permitidos @> ARRAY['inventario_maquinas']::text[]);



