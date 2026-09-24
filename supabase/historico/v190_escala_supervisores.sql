-- v190 — Escala de Supervisores: modelo base (Fase 1).
--
-- Modulo INTERNO da Chabra (supervisores da casa, unidades da casa). Substitui a
-- planilha "Escala dos Supervisores - Formato Hibrido".
--
-- Decisoes fechadas na Fase 0 e aprovadas antes desta migration:
--   1) Modulo SEPARADO da Gestao Gerencial. A gg_* escala quem atende nas unidades
--      por turno e resolve substituto; aqui o assunto e ONDE cada supervisor esta
--      por dia, com feriado e home office. Nenhuma tabela gg_* e tocada.
--   2) SEM empresa_id. A escala nao pertence a empresa cliente nenhuma. RLS igual a
--      v122: select using(true) para authenticated, escrita por caller_pode_editar().
--   3) Bloco A: o padrao semanal e SO por dia da semana (1..5). Nada de ciclo 15x15
--      nem de semana A/B -- ninguem na equipe trabalha assim hoje. Quem tiver rotacao
--      e lancado a mao no mes e protegido por origem='manual'.
--   4) Modulo VAZIO: zero supervisor, zero dia, zero unidade semeada. A planilha era
--      esboco, o dado dela nao entra.
--   5) Guapimirim e Piabeta contam SEPARADO. O campo equipe_compartilhada_com do
--      briefing original foi removido do modelo.
--   6) Acesso por modulos_permitidos, modulo novo 'escala_supervisores'.
--
-- NAO cria escala_unidades: a entidade de unidade do painel e public.unidades (v75),
-- usada por Gestao Gerencial, Frota, Equipamentos e Inventario. Um segundo cadastro de
-- Teresopolis seria duas listas para divergir. escala_unidade_config e 1:1 com ela e
-- guarda so o que a escala precisa (cor, ordem, municipio).
--
-- LIMITACAO CONHECIDA, de proposito: unidade_ids e TEXT[] (pedido do briefing) e o
-- Postgres nao aceita FK em elemento de array. Um id_unidade apagado continua dentro
-- do array das linhas antigas. Quem grava e a tela, que so oferece unidade viva; a
-- varredura de orfaos fica para a Fase 3, junto com a tela de unidades.
--
-- Idempotente e reversivel. Rollback em scripts/sql/v190_rollback_escala_supervisores.sql
-- (fora de supabase/migrations/ porque o migrate.ps1 varre esta pasta).
-- begin;...commit; PROPRIO -- NAO aplicar com psql -1.

begin;

-- ── (0) Guardas: falha fechada em vez de aplicar as cegas (padrao v186/v187) ──
do $$
begin
  if to_regclass('public.unidades') is null then
    raise exception 'v190: public.unidades (v75) nao existe -- escala_unidade_config dependeria dela; abortado';
  end if;
  if to_regprocedure('public.caller_pode_editar()') is null then
    raise exception 'v190: caller_pode_editar() ausente -- toda a RLS de escrita dependeria dela; abortado';
  end if;
  if to_regclass('public.usuarios') is null then
    raise exception 'v190: public.usuarios nao existe -- o registro do modulo dependeria dela; abortado';
  end if;
end $$;

-- ── (1) Supervisores ─────────────────────────────────────────────────────────
-- usuario_email e o vinculo OPCIONAL com a conta do painel. E e-mail, nao id: e o que
-- gestao_membros (v116) e gestao_tarefa_vinculados (v187) ja usam para ligar gente.
-- Sem FK para usuarios de proposito -- supervisor pode existir antes da conta.
create table if not exists public.escala_supervisores (
  id_supervisor text primary key
    default 'ESUP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  nome          text not null check (length(trim(nome)) > 0),
  nome_resumido text,
  funcao        text,
  usuario_email text check (usuario_email is null or usuario_email = lower(usuario_email)),
  ordem         int not null default 0,
  ativo         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz
);

-- ── (2) Config por unidade (1:1 com public.unidades) ─────────────────────────
-- PK = id_unidade: garante no banco que nao existe segunda linha para a mesma unidade.
-- municipio e o que o feriado municipal casa (ver escala_feriados).
create table if not exists public.escala_unidade_config (
  id_unidade text primary key references public.unidades(id_unidade) on delete cascade,
  cor_hex    text not null default '#006B54' check (cor_hex ~ '^#[0-9A-Fa-f]{6}$'),
  ordem      int not null default 0,
  municipio  text,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ── (3) Padrao semanal ───────────────────────────────────────────────────────
-- dia_semana 1..5 (Seg..Sex): fim de semana nao entra na escala.
-- vigencia_inicio/fim existem para que mudar a escala NAO reescreva mes ja fechado.
-- O CHECK do XOR e o que impede a linha ambigua: ou unidade(s), ou situacao.
create table if not exists public.escala_padrao_semanal (
  id_padrao       text primary key
    default 'EPAD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  id_supervisor   text not null references public.escala_supervisores(id_supervisor) on delete cascade,
  dia_semana      int not null check (dia_semana between 1 and 5),
  unidade_ids     text[] not null default '{}',
  situacao        text,
  vigencia_inicio date not null default current_date,
  vigencia_fim    date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz,
  constraint escala_padrao_vigencia_ok
    check (vigencia_fim is null or vigencia_fim >= vigencia_inicio),
  constraint escala_padrao_unidade_xor_situacao
    check ( (cardinality(unidade_ids) > 0 and situacao is null)
         or (cardinality(unidade_ids) = 0 and situacao is not null) ),
  constraint escala_padrao_situacao_valida
    check (situacao is null or situacao in
      ('Visita ao cliente','Home office','Folga','Férias','Treinamento','Atestado','Feriado'))
);
-- Uma linha por supervisor/dia/inicio de vigencia. NAO impede duas vigencias que se
-- sobrepoem -- isso exigiria EXCLUDE com btree_gist, e a tela da Fase 4 fecha a
-- vigencia anterior ao abrir a nova.
create unique index if not exists ux_escala_padrao_sup_dia_vig
  on public.escala_padrao_semanal (id_supervisor, dia_semana, vigencia_inicio);

-- ── (4) Dias materializados -- a tabela central ──────────────────────────────
-- Um registro por supervisor/dia. origem='manual' marca o que foi editado a mao e
-- NUNCA e sobrescrito por uma regeracao do mes (regra de ouro do modulo).
create table if not exists public.escala_dias (
  id_dia        text primary key
    default 'EDIA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  id_supervisor text not null references public.escala_supervisores(id_supervisor) on delete cascade,
  data          date not null,
  unidade_ids   text[] not null default '{}',
  situacao      text,
  origem        text not null default 'padrao' check (origem in ('padrao','manual')),
  observacao    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz,
  constraint escala_dias_unico_por_supervisor_data unique (id_supervisor, data),
  constraint escala_dias_unidade_xor_situacao
    check ( (cardinality(unidade_ids) > 0 and situacao is null)
         or (cardinality(unidade_ids) = 0 and situacao is not null) ),
  constraint escala_dias_situacao_valida
    check (situacao is null or situacao in
      ('Visita ao cliente','Home office','Folga','Férias','Treinamento','Atestado','Feriado'))
);

-- ── (5) Feriados ─────────────────────────────────────────────────────────────
-- Nao existe nenhuma nocao de feriado no painel hoje -- esta tabela nasce sozinha.
-- Municipal so bloqueia o dia de quem esta alocado naquele municipio, por isso
-- municipio e obrigatorio quando abrangencia='municipal'.
create table if not exists public.escala_feriados (
  id_feriado  text primary key
    default 'EFER-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  data        date not null,
  descricao   text not null check (length(trim(descricao)) > 0),
  abrangencia text not null check (abrangencia in ('nacional','estadual','municipal')),
  municipio   text,
  tipo        text not null default 'feriado' check (tipo in ('feriado','facultativo')),
  created_at  timestamptz not null default now(),
  constraint escala_feriados_municipio_obrigatorio
    check (abrangencia <> 'municipal' or (municipio is not null and length(trim(municipio)) > 0))
);
-- UNIQUE com expressao so existe como indice. E o que torna o semeador idempotente.
create unique index if not exists ux_escala_feriados_data_abrang_mun
  on public.escala_feriados (data, abrangencia, coalesce(municipio, ''));

-- ── (6) Regras de validacao ──────────────────────────────────────────────────
-- Na planilha os nomes estavam dentro da formula. Aqui viram parametros, e a regra
-- sobrevive a uma troca de equipe.
create table if not exists public.escala_regras (
  id_regra   text primary key
    default 'EREG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  codigo     text not null unique,
  descricao  text not null,
  parametros jsonb not null default '{}'::jsonb,
  ativa      boolean not null default true,
  ordem      int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ── (7) Log append-only ──────────────────────────────────────────────────────
-- SEM FK para escala_dias: um ON DELETE CASCADE apagaria a trilha justamente quando
-- ela importa. id_supervisor e data ficam desnormalizados aqui pelo mesmo motivo --
-- o log tem que continuar legivel depois do dia deixar de existir.
create table if not exists public.escala_log (
  id_log         text primary key
    default 'ELOG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  id_dia         text,
  id_supervisor  text,
  data           date,
  ator_email     text not null,
  valor_anterior jsonb,
  valor_novo     jsonb,
  criado_em      timestamptz not null default now()
);

-- ── (8) Indices ──────────────────────────────────────────────────────────────
create index if not exists idx_escala_sup_ativo        on public.escala_supervisores (ativo, ordem);
create index if not exists idx_escala_padrao_sup       on public.escala_padrao_semanal (id_supervisor, dia_semana);
create index if not exists idx_escala_dias_data        on public.escala_dias (data);
create index if not exists idx_escala_dias_sup_data    on public.escala_dias (id_supervisor, data);
-- GIN: o totalizador "dias por unidade" varre unidade_ids com && / @>.
create index if not exists idx_escala_dias_unidades    on public.escala_dias using gin (unidade_ids);
create index if not exists idx_escala_padrao_unidades  on public.escala_padrao_semanal using gin (unidade_ids);
create index if not exists idx_escala_feriados_data    on public.escala_feriados (data);
create index if not exists idx_escala_log_dia          on public.escala_log (id_dia, criado_em desc);

-- ── (9) RLS -- leitura autenticada, escrita caller_pode_editar() (padrao v122) ─
do $$
declare t text;
begin
  foreach t in array array['escala_supervisores','escala_unidade_config','escala_padrao_semanal',
                           'escala_dias','escala_feriados','escala_regras']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_sel', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_sel', t);
    execute format('drop policy if exists %I on public.%I', t || '_wr', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.caller_pode_editar()) with check (public.caller_pode_editar())',
                   t || '_wr', t);
  end loop;
end $$;

-- Log: append-only. SELECT para autenticado, INSERT para quem edita, e NENHUMA
-- policy de UPDATE ou DELETE -- sem policy, a operacao e negada pela RLS.
alter table public.escala_log enable row level security;
drop policy if exists escala_log_sel on public.escala_log;
create policy escala_log_sel on public.escala_log
  for select to authenticated using (true);
drop policy if exists escala_log_ins on public.escala_log;
create policy escala_log_ins on public.escala_log
  for insert to authenticated with check (public.caller_pode_editar());

-- ── (10) Pascoa e semeador de feriados ───────────────────────────────────────
-- Anonymous Gregorian (Meeus/Jones/Butcher). Conferido: 2026 -> 05/04, que e o
-- domingo de Pascoa que a planilha informava a mao.
create or replace function public.escala_pascoa(p_ano int)
returns date language plpgsql immutable as $$
declare
  a int; b int; c int; d int; e int; f int; g int;
  h int; i int; k int; l int; m int; mes int; dia int;
begin
  a := p_ano % 19;
  b := p_ano / 100;
  c := p_ano % 100;
  d := b / 4;
  e := b % 4;
  f := (b + 8) / 25;
  g := (b - f + 1) / 3;
  h := (19 * a + b - d - g + 15) % 30;
  i := c / 4;
  k := c % 4;
  l := (32 + 2 * e + 2 * i - h - k) % 7;
  m := (a + 11 * h + 22 * l) / 451;
  mes := (h + l - 7 * m + 114) / 31;
  dia := ((h + l - 7 * m + 114) % 31) + 1;
  return make_date(p_ano, mes, dia);
end $$;

comment on function public.escala_pascoa(int) is
  'Domingo de Pascoa do ano (Meeus/Jones/Butcher). Base das datas moveis da escala.';

-- Semeia os feriados nacionais + o estadual do RJ + as datas moveis de um ano.
-- Idempotente pelo indice unico: rodar de novo nao duplica e nao sobrescreve o que
-- alguem tiver corrigido a mao. Municipais NAO entram -- dependem de informacao que
-- a Chabra ainda nao passou (na planilha estavam como [CONFIRMAR]).
create or replace function public.escala_semear_feriados(p_ano int)
returns int language plpgsql as $$
declare
  v_pascoa date := public.escala_pascoa(p_ano);
  v_antes  int;
begin
  select count(*) into v_antes from public.escala_feriados;

  insert into public.escala_feriados (data, descricao, abrangencia, municipio, tipo)
  select x.data, x.descricao, x.abrangencia, null::text, x.tipo
  from (values
    (make_date(p_ano,  1,  1), 'Confraternização Universal',            'nacional', 'feriado'),
    (make_date(p_ano,  4, 21), 'Tiradentes',                            'nacional', 'feriado'),
    (make_date(p_ano,  5,  1), 'Dia do Trabalho',                       'nacional', 'feriado'),
    (make_date(p_ano,  9,  7), 'Independência do Brasil',               'nacional', 'feriado'),
    (make_date(p_ano, 10, 12), 'Nossa Senhora Aparecida',               'nacional', 'feriado'),
    (make_date(p_ano, 11,  2), 'Finados',                               'nacional', 'feriado'),
    (make_date(p_ano, 11, 15), 'Proclamação da República',              'nacional', 'feriado'),
    (make_date(p_ano, 11, 20), 'Consciência Negra',                     'nacional', 'feriado'),
    (make_date(p_ano, 12, 25), 'Natal',                                 'nacional', 'feriado'),
    (make_date(p_ano,  4, 23), 'São Jorge',                             'estadual', 'feriado'),
    (v_pascoa - 48,            'Carnaval — segunda-feira',              'nacional', 'facultativo'),
    (v_pascoa - 47,            'Carnaval — terça-feira',                'nacional', 'facultativo'),
    (v_pascoa -  2,            'Sexta-feira da Paixão',                 'nacional', 'feriado'),
    (v_pascoa + 60,            'Corpus Christi',                        'nacional', 'facultativo')
  ) as x(data, descricao, abrangencia, tipo)
  where not exists (
    select 1 from public.escala_feriados f
    where f.data = x.data and f.abrangencia = x.abrangencia and coalesce(f.municipio, '') = ''
  )
  -- Guarda contra colisao DENTRO da propria lista, que o `not exists` nao ve: quando a
  -- Pascoa cai em 23/04, a Sexta-feira da Paixao cai em 21/04 e bate de frente com
  -- Tiradentes (acontece em 2000 e 2079). Sem isto a funcao abortaria nesses anos.
  on conflict do nothing;

  return (select count(*) from public.escala_feriados) - v_antes;
end $$;

comment on function public.escala_semear_feriados(int) is
  'Semeia feriados nacionais + estadual RJ + datas moveis do ano. Idempotente. Municipais ficam de fora.';

-- ── (11) Seeds ───────────────────────────────────────────────────────────────
-- Feriados: 2026 (o ano da planilha) e 2027, para o modulo nao virar o ano em branco.
select public.escala_semear_feriados(2026);
select public.escala_semear_feriados(2027);

-- Regras: so as que NAO citam pessoa. As tres da planilha que nomeiam supervisor
-- (ancora da Julianna, par com a Amanda, par com a Thaynara) nao podem nascer aqui --
-- o modulo comeca sem supervisor nenhum (decisao 4). Elas sao criadas na tela.
-- 'sede_coberta' nasce INATIVA: precisa saber qual unidade e a sede, e escala_unidade_config
-- comeca vazia.
insert into public.escala_regras (codigo, descricao, parametros, ativa, ordem)
select x.codigo, x.descricao, x.parametros::jsonb, x.ativa, x.ordem
from (values
  ('min_supervisores_dia',
   'Todo dia útil com pelo menos N supervisores escalados',
   '{"minimo": 2}', true, 1),
  ('nenhum_dia_sem_supervisor',
   'Nenhum dia útil sem supervisor',
   '{}', true, 2),
  ('sede_coberta',
   'Sede coberta em todos os dias úteis',
   '{"id_unidade": null}', false, 3)
) as x(codigo, descricao, parametros, ativa, ordem)
where not exists (select 1 from public.escala_regras r where r.codigo = x.codigo);

-- Unidades: NENHUMA e semeada. A verdade e public.unidades (v75), que ja tem as bases
-- reais em producao. A linha de cor/ordem/municipio nasce na tela da Fase 3, para a
-- unidade que existir de fato -- nao para os seis nomes do esboco.

-- ── (12) Registro do modulo ──────────────────────────────────────────────────
-- Mesmo caminho da v122 (gestao_gerencial): quem tem modulos_permitidos EXPLICITO
-- recebe o modulo novo, senao perderia acesso a ele. Quem tem NULL ja herda todos.
-- Isso NAO da poder de escrita a ninguem: a escrita continua em caller_pode_editar(),
-- que so passa Admin e Tecnico.
update public.usuarios
  set modulos_permitidos = (
    select array_agg(distinct m)
    from unnest(coalesce(modulos_permitidos, '{}') || array['escala_supervisores']) m
  )
  where modulos_permitidos is not null
    and not ('escala_supervisores' = any(modulos_permitidos));

commit;
