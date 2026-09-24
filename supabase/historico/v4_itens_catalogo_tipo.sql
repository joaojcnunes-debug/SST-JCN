-- ============================================================
-- V4: Catálogo por Tipo de Risco
-- ============================================================
-- Cada tipo de risco mantém listas pré-cadastradas de agentes,
-- fontes geradoras, EPIs/EPCs e medidas. Essas listas alimentam
-- selects/sugestões do RiscoForm pra padronizar e acelerar o
-- cadastro. As 8 categorias correspondem às colunas da planilha
-- modelo do cliente (com EPC utilizado adicionado por simetria
-- com EPI).
--
-- Idempotente — pode ser rodado várias vezes no SQL Editor.
-- ============================================================

create table if not exists public.itens_catalogo_tipo (
  id_item       text primary key,
  id_tipo       text not null references public.tipos_risco(id_tipo) on delete cascade,
  categoria     text not null check (categoria in (
    'agente',
    'fonte_geradora',
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

create index if not exists idx_catalogo_tipo_categoria
  on public.itens_catalogo_tipo (id_tipo, categoria, ordem);

-- Evita duplicar o mesmo texto na mesma categoria do mesmo tipo
-- (case-insensitive). Permite o mesmo texto em categorias diferentes.
create unique index if not exists ux_catalogo_tipo_unico
  on public.itens_catalogo_tipo (id_tipo, categoria, lower(texto));

-- RLS — mesmo padrão das outras tabelas: leitura/escrita p/ authenticated.
-- Diferenciação Admin vs Tecnico/Visualizador é feita no client.
alter table public.itens_catalogo_tipo enable row level security;

drop policy if exists "auth read itens_catalogo_tipo" on public.itens_catalogo_tipo;
create policy "auth read itens_catalogo_tipo"
  on public.itens_catalogo_tipo for select
  to authenticated using (true);

drop policy if exists "auth write itens_catalogo_tipo" on public.itens_catalogo_tipo;
create policy "auth write itens_catalogo_tipo"
  on public.itens_catalogo_tipo for all
  to authenticated using (true) with check (true);
