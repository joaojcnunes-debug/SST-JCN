-- ============================================================
-- V5: Modelos de Risco (catálogo centrado no agente)
-- ============================================================
-- Cada agente cadastrado vira um "modelo" — um kit fechado com
-- fonte geradora, EPIs/EPCs, medidas e perguntas customizadas
-- específicas. No RiscoForm, escolher o modelo pré-preenche o
-- formulário inteiro.
--
-- Coexiste com V4 (`itens_catalogo_tipo` e `perguntas_tipo_risco`):
--   - V4 = biblioteca compartilhada do tipo (datalists genéricos)
--   - V5 = modelos específicos por agente (kit completo)
--
-- Idempotente — pode ser rodado várias vezes no SQL Editor.
-- ============================================================

-- 1) MODELOS_RISCO -----------------------------------------------
create table if not exists public.modelos_risco (
  id_modelo       text primary key,
  id_tipo         text not null references public.tipos_risco(id_tipo) on delete cascade,
  agente          text not null,
  fonte_geradora  text,
  ordem           int  not null default 0,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz
);

create index if not exists idx_modelos_tipo
  on public.modelos_risco (id_tipo, ordem);

-- Não permite mesmo agente duplicado dentro do mesmo tipo
-- (case-insensitive). Escopo é (id_tipo, agente).
create unique index if not exists ux_modelo_unico
  on public.modelos_risco (id_tipo, lower(agente));

alter table public.modelos_risco enable row level security;

drop policy if exists "auth read modelos_risco" on public.modelos_risco;
create policy "auth read modelos_risco"
  on public.modelos_risco for select
  to authenticated using (true);

drop policy if exists "auth write modelos_risco" on public.modelos_risco;
create policy "auth write modelos_risco"
  on public.modelos_risco for all
  to authenticated using (true) with check (true);


-- 2) ITENS_MODELO_RISCO ------------------------------------------
-- Listas filhas de um modelo. 6 categorias (sem agente/fonte porque
-- o modelo já É o agente, e fonte vai num campo único do modelo).
create table if not exists public.itens_modelo_risco (
  id_item       text primary key,
  id_modelo     text not null references public.modelos_risco(id_modelo) on delete cascade,
  categoria     text not null check (categoria in (
    'epi_utilizado',
    'epi_recomendado',
    'epc_utilizado',
    'epc_recomendado',
    'medida_adotada',
    'medida_recomendada'
  )),
  texto         text not null,
  ordem         int  not null default 0,
  ativo         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz
);

create index if not exists idx_itens_modelo_categoria
  on public.itens_modelo_risco (id_modelo, categoria, ordem);

create unique index if not exists ux_item_modelo_unico
  on public.itens_modelo_risco (id_modelo, categoria, lower(texto));

alter table public.itens_modelo_risco enable row level security;

drop policy if exists "auth read itens_modelo_risco" on public.itens_modelo_risco;
create policy "auth read itens_modelo_risco"
  on public.itens_modelo_risco for select
  to authenticated using (true);

drop policy if exists "auth write itens_modelo_risco" on public.itens_modelo_risco;
create policy "auth write itens_modelo_risco"
  on public.itens_modelo_risco for all
  to authenticated using (true) with check (true);


-- 3) PERGUNTAS_MODELO_RISCO --------------------------------------
-- Mesma forma de perguntas_tipo_risco, mas atrelada a um modelo.
-- No form, perguntas do tipo + perguntas do modelo aparecem
-- combinadas (tipo primeiro, modelo depois — ordem dentro de cada).
create table if not exists public.perguntas_modelo_risco (
  id_pergunta   text primary key,
  id_modelo     text not null references public.modelos_risco(id_modelo) on delete cascade,
  chave         text not null,
  texto         text not null,
  input_type    text not null check (input_type in ('select', 'text', 'textarea')),
  opcoes        text[] not null default '{}',
  ordem         int  not null default 0,
  obrigatoria   boolean not null default false,
  ativo         boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists idx_perguntas_modelo
  on public.perguntas_modelo_risco (id_modelo, ordem);

-- Mesma chave não pode existir 2x dentro do mesmo modelo
create unique index if not exists ux_pergunta_modelo_chave
  on public.perguntas_modelo_risco (id_modelo, chave);

alter table public.perguntas_modelo_risco enable row level security;

drop policy if exists "auth read perguntas_modelo_risco" on public.perguntas_modelo_risco;
create policy "auth read perguntas_modelo_risco"
  on public.perguntas_modelo_risco for select
  to authenticated using (true);

drop policy if exists "auth write perguntas_modelo_risco" on public.perguntas_modelo_risco;
create policy "auth write perguntas_modelo_risco"
  on public.perguntas_modelo_risco for all
  to authenticated using (true) with check (true);


-- 4) MIGRAÇÃO DE DADOS V4 → V5 -----------------------------------
-- Cada `itens_catalogo_tipo` com categoria='agente' vira um modelo
-- vazio (sem fonte associada e sem itens filhos). O id do modelo é
-- determinístico (md5 do id_item original) para permitir re-run.
INSERT INTO public.modelos_risco (id_modelo, id_tipo, agente, fonte_geradora, ordem, ativo)
SELECT
  'MOD_' || md5(i.id_item),
  i.id_tipo,
  i.texto,
  null,
  i.ordem,
  i.ativo
FROM public.itens_catalogo_tipo i
WHERE i.categoria = 'agente'
ON CONFLICT (id_modelo) DO NOTHING;

-- Riscos cadastrados não recebem id_modelo automaticamente — quem
-- quiser correlacionar terá que reabrir o risco e selecionar.
-- Isso é intencional: a migração de itens (EPIs/medidas) pra dentro
-- de modelos é manual (ou via auto-semeadura conforme uso).

-- Coluna opcional `id_modelo` em riscos pra histórico (saber qual
-- modelo gerou o risco). Permite null pra riscos antigos.
alter table public.riscos
  add column if not exists id_modelo text references public.modelos_risco(id_modelo) on delete set null;

create index if not exists idx_riscos_modelo
  on public.riscos (id_modelo) where id_modelo is not null;
