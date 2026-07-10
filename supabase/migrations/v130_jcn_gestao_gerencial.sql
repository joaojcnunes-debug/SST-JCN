-- v130 (JCN) — Gestão Gerencial: Escalas e Substituições.
-- Reflexo do Painel-SST (migrations v122+v123+v126 consolidadas; v124/v125 eram
-- RPCs intermediárias substituídas pela v126). Módulo administrativo INTERNO:
-- RLS `select using(true)`, escrita `caller_pode_editar()`, SEM empresa_id.
-- Reusa `unidades` (JCN v75). Idempotente/reversível.

-- ═══ Parte A (painel v122) — modelo base ═══════════════════════════════════════
create table if not exists public.gg_categorias (
  id text primary key default gen_random_uuid()::text,
  nome text not null,
  ordem int not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.gg_turnos (
  id text primary key default gen_random_uuid()::text,
  nome text not null,
  ordem int not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.gg_profissionais (
  id text primary key default gen_random_uuid()::text,
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.gg_profissional_unidades (
  id text primary key default gen_random_uuid()::text,
  id_profissional text not null references public.gg_profissionais(id) on delete cascade,
  id_unidade      text not null references public.unidades(id_unidade) on delete cascade,
  created_at timestamptz not null default now(),
  unique (id_profissional, id_unidade)
);
create table if not exists public.gg_escala_padrao (
  id text primary key default gen_random_uuid()::text,
  id_profissional text not null references public.gg_profissionais(id) on delete cascade,
  id_unidade      text not null references public.unidades(id_unidade) on delete cascade,
  dia_semana int not null check (dia_semana between 1 and 7),
  id_turno text not null references public.gg_turnos(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (id_profissional, id_unidade, dia_semana, id_turno)
);
create table if not exists public.gg_ausencias (
  id text primary key default gen_random_uuid()::text,
  id_profissional text not null references public.gg_profissionais(id) on delete cascade,
  tipo text not null check (tipo in ('folga','ferias','atestado','falta','in_loco')),
  data_inicio date not null,
  data_fim    date not null,
  obs text,
  created_at timestamptz not null default now()
);

create index if not exists idx_gg_pu_prof           on public.gg_profissional_unidades(id_profissional);
create index if not exists idx_gg_pu_unid           on public.gg_profissional_unidades(id_unidade);
create index if not exists idx_gg_escala_prof       on public.gg_escala_padrao(id_profissional);
create index if not exists idx_gg_escala_unid       on public.gg_escala_padrao(id_unidade, dia_semana);
create index if not exists idx_gg_ausencias_prof    on public.gg_ausencias(id_profissional);
create index if not exists idx_gg_ausencias_periodo on public.gg_ausencias(data_inicio, data_fim);

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

-- ═══ Parte B (painel v123) — categorias/turnos POR UNIDADE ══════════════════════
alter table public.gg_categorias add column if not exists id_unidade text references public.unidades(id_unidade) on delete cascade;
alter table public.gg_turnos     add column if not exists id_unidade text references public.unidades(id_unidade) on delete cascade;
alter table public.gg_profissional_unidades add column if not exists id_categoria text references public.gg_categorias(id) on delete set null;

delete from public.gg_turnos     where id_unidade is null;
delete from public.gg_categorias where id_unidade is null;
do $$
begin
  if not exists (select 1 from public.gg_categorias where id_unidade is null) then
    alter table public.gg_categorias alter column id_unidade set not null;
  end if;
  if not exists (select 1 from public.gg_turnos where id_unidade is null) then
    alter table public.gg_turnos alter column id_unidade set not null;
  end if;
end $$;

create unique index if not exists uq_gg_categorias_unid_nome on public.gg_categorias (id_unidade, lower(nome));
create unique index if not exists uq_gg_turnos_unid_nome     on public.gg_turnos (id_unidade, lower(nome));
create index if not exists idx_gg_categorias_unid on public.gg_categorias(id_unidade);
create index if not exists idx_gg_turnos_unid     on public.gg_turnos(id_unidade);
create index if not exists idx_gg_pu_categoria    on public.gg_profissional_unidades(id_categoria);

insert into public.gg_turnos (id, nome, ordem, id_unidade)
  select 'TRN-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)), x.nome, x.ord, u.id_unidade
  from public.unidades u
  cross join (values ('Manhã',1),('Tarde',2)) as x(nome, ord)
  where not exists (select 1 from public.gg_turnos g where g.id_unidade = u.id_unidade and lower(g.nome) = lower(x.nome));

insert into public.gg_categorias (id, nome, ordem, id_unidade)
  select 'CAT-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)), x.nome, x.ord, u.id_unidade
  from public.unidades u
  cross join (values ('Médico',1),('Técnico',2),('Fonoaudiólogo',3)) as x(nome, ord)
  where not exists (select 1 from public.gg_categorias g where g.id_unidade = u.id_unidade and lower(g.nome) = lower(x.nome));

-- ═══ Parte C (painel v126) — disponibilidade (tri-estado) + substituição + RPCs ═
alter table public.gg_escala_padrao add column if not exists tipo text not null default 'trabalha';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'gg_escala_padrao_tipo_chk') then
    alter table public.gg_escala_padrao
      add constraint gg_escala_padrao_tipo_chk check (tipo in ('trabalha','disponivel'));
  end if;
end $$;

create table if not exists public.gg_substituicoes (
  id text primary key default gen_random_uuid()::text,
  id_unidade text not null references public.unidades(id_unidade) on delete cascade,
  data date not null,
  id_turno text not null references public.gg_turnos(id) on delete cascade,
  id_ausente text not null references public.gg_profissionais(id) on delete cascade,
  id_substituto text not null references public.gg_profissionais(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (id_unidade, data, id_turno, id_ausente)
);
create index if not exists idx_gg_subs_unid_data on public.gg_substituicoes(id_unidade, data);

alter table public.gg_substituicoes enable row level security;
drop policy if exists gg_substituicoes_sel on public.gg_substituicoes;
create policy gg_substituicoes_sel on public.gg_substituicoes for select to authenticated using (true);
drop policy if exists gg_substituicoes_wr on public.gg_substituicoes;
create policy gg_substituicoes_wr on public.gg_substituicoes for all to authenticated
  using (public.caller_pode_editar()) with check (public.caller_pode_editar());

drop function if exists public.gg_sugerir_substitutos(text, date);
create or replace function public.gg_sugerir_substitutos(p_id_unidade text, p_data date)
returns table (
  id_turno text, turno_nome text, id_categoria text, categoria_nome text,
  id_ausente text, ausente_nome text, tipo_ausencia text,
  id_substituto text, substituto_nome text
)
language sql stable set search_path = public as $$
  with dia as (select extract(isodow from p_data)::int as d),
  slots as (
    select e.id_profissional, e.id_turno, t.nome as turno_nome, e.dia_semana,
           pu.id_categoria, c.nome as categoria_nome
    from gg_escala_padrao e
    join dia on e.dia_semana = dia.d
    join gg_turnos t on t.id = e.id_turno
    left join gg_profissional_unidades pu on pu.id_profissional = e.id_profissional and pu.id_unidade = e.id_unidade
    left join gg_categorias c on c.id = pu.id_categoria
    where e.id_unidade = p_id_unidade and e.tipo = 'trabalha'
  ),
  descobertos as (
    select s.*, p.nome as ausente_nome,
      (select a.tipo from gg_ausencias a
        where a.id_profissional = s.id_profissional and p_data between a.data_inicio and a.data_fim
        order by (a.tipo = 'in_loco') desc, a.data_inicio limit 1) as tipo_ausencia
    from slots s join gg_profissionais p on p.id = s.id_profissional
    where exists (select 1 from gg_ausencias a where a.id_profissional = s.id_profissional and p_data between a.data_inicio and a.data_fim)
  )
  select d.id_turno, d.turno_nome, d.id_categoria, d.categoria_nome,
         d.id_profissional as id_ausente, d.ausente_nome, d.tipo_ausencia,
         cand.id_substituto, cand.substituto_nome
  from descobertos d
  left join lateral (
    select disp.id_profissional as id_substituto, cp.nome as substituto_nome
    from gg_escala_padrao disp
    join gg_profissionais cp on cp.id = disp.id_profissional and cp.ativo = true
    join gg_profissional_unidades pu2 on pu2.id_profissional = disp.id_profissional and pu2.id_unidade = p_id_unidade
    where disp.id_unidade = p_id_unidade and disp.tipo = 'disponivel'
      and disp.id_turno = d.id_turno and disp.dia_semana = d.dia_semana
      and pu2.id_categoria = d.id_categoria
      and disp.id_profissional <> d.id_profissional
      and not exists (select 1 from gg_ausencias a2 where a2.id_profissional = disp.id_profissional and p_data between a2.data_inicio and a2.data_fim)
      and not exists (
        select 1 from gg_escala_padrao e2 join gg_turnos t2 on t2.id = e2.id_turno
        where e2.id_profissional = disp.id_profissional and e2.tipo = 'trabalha'
          and e2.dia_semana = d.dia_semana and lower(t2.nome) = lower(d.turno_nome))
  ) cand on true
  order by d.turno_nome, d.ausente_nome, cand.substituto_nome nulls last;
$$;
grant execute on function public.gg_sugerir_substitutos(text, date) to authenticated;

drop function if exists public.gg_projecao_mensal(text, int, int);
create or replace function public.gg_projecao_mensal(p_id_unidade text, p_ano int, p_mes int)
returns table (
  data date, id_turno text, turno_nome text, id_categoria text, categoria_nome text,
  id_ausente text, ausente_nome text, tipo_ausencia text,
  id_substituto text, substituto_nome text
)
language sql stable set search_path = public as $$
  with dias as (
    select d::date as data
    from generate_series(make_date(p_ano, p_mes, 1),
      (make_date(p_ano, p_mes, 1) + interval '1 month' - interval '1 day')::date, interval '1 day') d
  ),
  slots as (
    select dd.data, e.id_profissional, e.id_turno, t.nome as turno_nome, e.dia_semana,
           pu.id_categoria, c.nome as categoria_nome
    from dias dd
    join gg_escala_padrao e on e.dia_semana = extract(isodow from dd.data)::int and e.id_unidade = p_id_unidade and e.tipo = 'trabalha'
    join gg_turnos t on t.id = e.id_turno
    left join gg_profissional_unidades pu on pu.id_profissional = e.id_profissional and pu.id_unidade = e.id_unidade
    left join gg_categorias c on c.id = pu.id_categoria
  ),
  descobertos as (
    select s.*, p.nome as ausente_nome,
      (select a.tipo from gg_ausencias a
        where a.id_profissional = s.id_profissional and s.data between a.data_inicio and a.data_fim
        order by (a.tipo = 'in_loco') desc, a.data_inicio limit 1) as tipo_ausencia
    from slots s join gg_profissionais p on p.id = s.id_profissional
    where exists (select 1 from gg_ausencias a where a.id_profissional = s.id_profissional and s.data between a.data_inicio and a.data_fim)
  )
  select d.data, d.id_turno, d.turno_nome, d.id_categoria, d.categoria_nome,
         d.id_profissional as id_ausente, d.ausente_nome, d.tipo_ausencia,
         cand.id_substituto, cand.substituto_nome
  from descobertos d
  left join lateral (
    select disp.id_profissional as id_substituto, cp.nome as substituto_nome
    from gg_escala_padrao disp
    join gg_profissionais cp on cp.id = disp.id_profissional and cp.ativo = true
    join gg_profissional_unidades pu2 on pu2.id_profissional = disp.id_profissional and pu2.id_unidade = p_id_unidade
    where disp.id_unidade = p_id_unidade and disp.tipo = 'disponivel'
      and disp.id_turno = d.id_turno and disp.dia_semana = d.dia_semana
      and pu2.id_categoria = d.id_categoria
      and disp.id_profissional <> d.id_profissional
      and not exists (select 1 from gg_ausencias a2 where a2.id_profissional = disp.id_profissional and d.data between a2.data_inicio and a2.data_fim)
      and not exists (
        select 1 from gg_escala_padrao e2 join gg_turnos t2 on t2.id = e2.id_turno
        where e2.id_profissional = disp.id_profissional and e2.tipo = 'trabalha'
          and e2.dia_semana = d.dia_semana and lower(t2.nome) = lower(d.turno_nome))
  ) cand on true
  order by d.data, d.turno_nome, d.ausente_nome, cand.substituto_nome nulls last;
$$;
grant execute on function public.gg_projecao_mensal(text, int, int) to authenticated;

-- ═══ Registro do módulo (painel v122) ══════════════════════════════════════════
update public.usuarios
  set modulos_permitidos = (
    select array_agg(distinct m)
    from unnest(coalesce(modulos_permitidos, '{}') || array['gestao_gerencial']) m
  )
  where modulos_permitidos is not null
    and not ('gestao_gerencial' = any(modulos_permitidos));
