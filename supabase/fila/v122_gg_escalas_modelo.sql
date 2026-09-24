-- v122 — Gestão Gerencial: modelo de Escalas e Substituições (Fase 2).
--
-- Módulo administrativo INTERNO (padrão Gestão Chabra): RLS `select using(true)`, escrita
-- `caller_pode_editar()`, SEM empresa_id. Reusa a entidade `unidades` (v75).
-- Decisões de modelagem (validadas): profissional atua em VÁRIAS unidades (N:N); turnos e
-- categorias configuráveis; "in_loco" é tipo de ausência que exige substituto.
-- Idempotente/reversível.

-- ── Categorias configuráveis (Médicos/Técnicos/Fono) ─────────────────────────
create table if not exists public.gg_categorias (
  id text primary key default gen_random_uuid()::text,
  nome text not null,
  ordem int not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── Turnos configuráveis (Manhã/Tarde/Noite) ─────────────────────────────────
create table if not exists public.gg_turnos (
  id text primary key default gen_random_uuid()::text,
  nome text not null,
  ordem int not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── Profissionais (sem unidade fixa — vínculo N:N abaixo) ─────────────────────
create table if not exists public.gg_profissionais (
  id text primary key default gen_random_uuid()::text,
  nome text not null,
  id_categoria text references public.gg_categorias(id) on delete set null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── N:N profissional ↔ unidade (em quais unidades atua) ──────────────────────
create table if not exists public.gg_profissional_unidades (
  id text primary key default gen_random_uuid()::text,
  id_profissional text not null references public.gg_profissionais(id) on delete cascade,
  id_unidade      text not null references public.unidades(id_unidade) on delete cascade,
  created_at timestamptz not null default now(),
  unique (id_profissional, id_unidade)
);

-- ── Escala padrão semanal (profissional × unidade × dia × turno) ─────────────
create table if not exists public.gg_escala_padrao (
  id text primary key default gen_random_uuid()::text,
  id_profissional text not null references public.gg_profissionais(id) on delete cascade,
  id_unidade      text not null references public.unidades(id_unidade) on delete cascade,
  dia_semana int not null check (dia_semana between 1 and 7),   -- 1=Seg … 7=Dom
  id_turno text not null references public.gg_turnos(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (id_profissional, id_unidade, dia_semana, id_turno)
);

-- ── Ausências / indisponibilidades (inclui in_loco → exige substituto) ───────
create table if not exists public.gg_ausencias (
  id text primary key default gen_random_uuid()::text,
  id_profissional text not null references public.gg_profissionais(id) on delete cascade,
  tipo text not null check (tipo in ('folga','ferias','atestado','falta','in_loco')),
  data_inicio date not null,
  data_fim    date not null,
  obs text,
  created_at timestamptz not null default now()
);

-- ── Índices ──────────────────────────────────────────────────────────────────
create index if not exists idx_gg_prof_categoria    on public.gg_profissionais(id_categoria);
create index if not exists idx_gg_pu_prof           on public.gg_profissional_unidades(id_profissional);
create index if not exists idx_gg_pu_unid           on public.gg_profissional_unidades(id_unidade);
create index if not exists idx_gg_escala_prof       on public.gg_escala_padrao(id_profissional);
create index if not exists idx_gg_escala_unid       on public.gg_escala_padrao(id_unidade, dia_semana);
create index if not exists idx_gg_ausencias_prof    on public.gg_ausencias(id_profissional);
create index if not exists idx_gg_ausencias_periodo on public.gg_ausencias(data_inicio, data_fim);

-- ── RLS interno (leitura autenticada; escrita caller_pode_editar) — idempotente ─
do $$
declare t text;
begin
  foreach t in array array['gg_categorias','gg_turnos','gg_profissionais','gg_profissional_unidades','gg_escala_padrao','gg_ausencias']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_sel', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_sel', t);
    execute format('drop policy if exists %I on public.%I', t || '_wr', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.caller_pode_editar()) with check (public.caller_pode_editar())', t || '_wr', t);
  end loop;
end $$;

-- ── Seeds default (idempotente): turnos + categorias base ────────────────────
insert into public.gg_turnos (id, nome, ordem)
  select 'TRN-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)), x.nome, x.ord
  from (values ('Manhã',1),('Tarde',2)) as x(nome, ord)
  where not exists (select 1 from public.gg_turnos g where lower(g.nome) = lower(x.nome));

insert into public.gg_categorias (id, nome, ordem)
  select 'CAT-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)), x.nome, x.ord
  from (values ('Médico',1),('Técnico',2),('Fonoaudiólogo',3)) as x(nome, ord)
  where not exists (select 1 from public.gg_categorias g where lower(g.nome) = lower(x.nome));

-- ── Registro do módulo: concede 'gestao_gerencial' a quem já tem modulos_permitidos
--    explícito (senão perde acesso ao módulo novo). Usuários com NULL herdam todos por padrão. ─
update public.usuarios
  set modulos_permitidos = (
    select array_agg(distinct m)
    from unnest(coalesce(modulos_permitidos, '{}') || array['gestao_gerencial']) m
  )
  where modulos_permitidos is not null
    and not ('gestao_gerencial' = any(modulos_permitidos));
