-- V31 — Base de referência editável de agentes químicos (NR-15)
--
-- Substitui o array estático em `lib/quimicos/base_referencia.ts` por uma
-- tabela administrável. O array estático continua existindo no código como
-- fallback (e como dados de seed que o Admin pode importar com 1 clique
-- pela tela /analise-quimicos/base).
--
-- RLS permissivo: qualquer usuário autenticado lê (necessário pro lookup
-- determinístico do módulo de Análise de Químicos). Quem pode escrever é
-- controlado pelo frontend via `perfil = 'Admin'` (mesmo padrão das outras
-- tabelas administrativas do projeto).

create table if not exists public.base_referencia_quimicos (
  id                text primary key,
  agente            text not null,
  cas               text,

  -- Limites de tolerância (NR-15)
  lt_mg_m3          numeric,
  lt_ppm            numeric,
  grau_nr15         text check (
    grau_nr15 is null
    or grau_nr15 in ('Mínimo', 'Médio', 'Máximo', 'Asfixiante simples')
  ),
  teto              boolean,
  pele              boolean,

  -- Classificações externas
  esocial_tab24     text,
  iarc              text check (
    iarc is null
    or iarc in ('Grupo 1', 'Grupo 2A', 'Grupo 2B', 'Grupo 3', 'Grupo 4')
  ),
  inflamavel        boolean,
  cancerigeno_13a   boolean,
  tlv_acgih         text,
  decreto_3048      text,
  cod_gfip          text,
  anexo             text check (
    anexo is null
    or anexo in ('Anexo 11', 'Anexo 12', 'Anexo 13', 'Anexo 13-A')
  ),
  observacoes       text,

  -- Marcador "vide X" — entrada cujo dado real está em outro agente
  is_alias          boolean not null default false,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz
);

create index if not exists idx_base_referencia_quimicos_cas
  on public.base_referencia_quimicos (cas);

create index if not exists idx_base_referencia_quimicos_agente
  on public.base_referencia_quimicos (agente);

create index if not exists idx_base_referencia_quimicos_anexo
  on public.base_referencia_quimicos (anexo);

alter table public.base_referencia_quimicos enable row level security;

drop policy if exists "auth read base_referencia_quimicos"
  on public.base_referencia_quimicos;
create policy "auth read base_referencia_quimicos"
  on public.base_referencia_quimicos for select to authenticated using (true);

drop policy if exists "auth write base_referencia_quimicos"
  on public.base_referencia_quimicos;
create policy "auth write base_referencia_quimicos"
  on public.base_referencia_quimicos for all to authenticated
  using (true) with check (true);
