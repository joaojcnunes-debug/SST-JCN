-- v127 — Gestão de EPI (Fase 1): cadastro (colaboradores + catálogo) e estoque.
--
-- Portado do SST-JCN (guia ficha-epi), adaptado à RLS do painel-sst:
--   • tabelas por empresa → SELECT: caller_pode_ver_empresa(empresa_id);
--     escrita: caller_pode_editar() AND caller_pode_ver_empresa(empresa_id)
--     (mesmo padrão de v76 — NÃO usa get_minhas_empresas, que não existe aqui).
--   • epi_movimentacoes é APPEND-ONLY (só SELECT + INSERT; saldo é derivado).
-- empresa_id é TEXT (empresas.id_empresa). IDs client-gen 'PREFIX-XXXXXXXX'.
-- Idempotente/reversível.

-- ── Colaboradores (roster por empresa) — CRUD ────────────────────────────────
create table if not exists public.epi_colaboradores (
  id          text primary key default gen_random_uuid()::text,
  empresa_id  text not null references public.empresas(id_empresa) on delete cascade,
  nome        text not null,
  cpf         text,
  matricula   text,
  cargo       text,
  setor       text,
  ativo       boolean not null default true,
  criado_por  text,
  criado_em   timestamptz not null default now(),
  updated_at  timestamptz
);

-- ── Catálogo de EPI/EPC (com C.A.) — CRUD ────────────────────────────────────
create table if not exists public.epi_catalogo (
  id             text primary key default gen_random_uuid()::text,
  empresa_id     text not null references public.empresas(id_empresa) on delete cascade,
  nome           text not null,
  tipo           text not null default 'EPI' check (tipo in ('EPI','EPC')),
  ca_numero      text,
  ca_validade    date,
  fabricante     text,
  descricao      text,
  unidade        text,                       -- unidade de medida (par, un, cx…)
  estoque_minimo numeric not null default 0,
  foto_url       text,
  foto_path      text,
  ativo          boolean not null default true,
  criado_por     text,
  criado_em      timestamptz not null default now(),
  updated_at     timestamptz
);

-- ── Movimentações de estoque (APPEND-ONLY; saldo derivado) ───────────────────
create table if not exists public.epi_movimentacoes (
  id          text primary key default gen_random_uuid()::text,
  empresa_id  text not null references public.empresas(id_empresa) on delete cascade,
  id_catalogo text not null references public.epi_catalogo(id) on delete cascade,
  tipo        text not null check (tipo in ('entrada','saida','ajuste')),
  quantidade  numeric not null check (quantidade > 0),
  origem      text,                          -- 'manual' | 'nfe' | 'entrega' | 'transferencia'
  ref_id      text,                          -- chNFe / id_entrega / id_transferencia
  motivo      text,
  responsavel text,
  criado_por  text,
  criado_em   timestamptz not null default now()
);

-- ── Índices ──────────────────────────────────────────────────────────────────
create index if not exists idx_epi_colab_empresa   on public.epi_colaboradores(empresa_id);
create index if not exists idx_epi_catalogo_empresa on public.epi_catalogo(empresa_id);
create index if not exists idx_epi_mov_empresa      on public.epi_movimentacoes(empresa_id);
create index if not exists idx_epi_mov_catalogo     on public.epi_movimentacoes(id_catalogo);

-- ── Saldo derivado (entrada/ajuste somam, saída subtrai) — security_invoker ──
create or replace view public.v_epi_saldo with (security_invoker = true) as
  select empresa_id, id_catalogo,
         sum(case when tipo = 'saida' then -quantidade else quantidade end) as saldo
  from public.epi_movimentacoes
  group by empresa_id, id_catalogo;

-- ── RLS por empresa (padrão v76): CRUD nas de cadastro; append-only na de mov ─
do $$
declare t text;
begin
  -- CRUD: colaboradores e catálogo
  foreach t in array array['epi_colaboradores','epi_catalogo']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_sel', t);
    execute format($f$create policy %I on public.%I for select to authenticated using (public.caller_pode_ver_empresa(empresa_id))$f$, t||'_sel', t);
    execute format('drop policy if exists %I on public.%I', t||'_rw', t);
    execute format($f$create policy %I on public.%I for all to authenticated using (public.caller_pode_editar() and public.caller_pode_ver_empresa(empresa_id)) with check (public.caller_pode_editar() and public.caller_pode_ver_empresa(empresa_id))$f$, t||'_rw', t);
  end loop;

  -- APPEND-ONLY: movimentações (só SELECT + INSERT)
  execute 'alter table public.epi_movimentacoes enable row level security';
  execute 'drop policy if exists epi_movimentacoes_sel on public.epi_movimentacoes';
  execute 'create policy epi_movimentacoes_sel on public.epi_movimentacoes for select to authenticated using (public.caller_pode_ver_empresa(empresa_id))';
  execute 'drop policy if exists epi_movimentacoes_ins on public.epi_movimentacoes';
  execute 'create policy epi_movimentacoes_ins on public.epi_movimentacoes for insert to authenticated with check (public.caller_pode_editar() and public.caller_pode_ver_empresa(empresa_id))';
end $$;

-- ── Registro do módulo: concede 'epi' a quem tem modulos_permitidos explícito ─
--    (usuários com NULL herdam todos por padrão). Igual v122 (gestao_gerencial).
update public.usuarios
  set modulos_permitidos = (
    select array_agg(distinct m)
    from unnest(coalesce(modulos_permitidos, '{}') || array['epi']) m
  )
  where modulos_permitidos is not null
    and not ('epi' = any(modulos_permitidos));
