-- v257 — DIM-01: marcar colaborador que NÃO entra no cálculo do dimensionamento.
--
-- POR QUE ISTO EXISTE, E O QUE MUDA NO NÚMERO (medido em 2026-09-24, todas as unidades,
-- setembro/2026): a equipe aparece como **31 pessoas / 29,5 em tempo integral**, mas
-- **8 delas (6,5 FTE, todas Administrativas) têm produção diária zerada** — gente em
-- treinamento, atuando em outra área, ou da gestão.
--
-- O motor já protegia as duas coisas certas: a régua de produtividade (`comProducao`) e o
-- quadro necessário (`ideal = precisa / produçãoDeUmProdutorReal`) ignoram quem tem 0/dia.
-- O que elas afetavam é `areas[f].quadro` — o FTE da equipe — e o déficit é
-- `necessário − quadro`. Ou seja: **6,5 FTE que não entregam nada contavam como
-- capacidade, e o déficit saía SUBESTIMADO**.
--
-- ⚠️ Consequência aceita pelo operador em 2026-09-24: marcar essas pessoas **aumenta** o
-- déficit exibido (estimativa: +24 → ~+31 no total, administrativo +16 → ~+23). Não é
-- regressão — é a falta que já existia aparecendo. Quem olhar o painel no dia seguinte
-- vai ver o número subir sem nenhum documento novo ter entrado; está escrito aqui para
-- que ninguém procure um bug que não existe.
--
-- Duas colunas e não uma: o operador quer distinguir o motivo na tela. As duas têm o
-- MESMO efeito no cálculo (a pessoa vira `tipoProducao = 'nenhuma'` em
-- `colaboradoresCompletos`); só o rótulo muda.
--
-- Não mexe em grant: os privilégios de `dim_colaboradores` são de TABELA
-- (`grant select, insert, update, delete ... to authenticated`, v249), então coluna nova
-- os herda. Quem barra continua sendo a RLS admin-only.
--
-- Rollback: scripts/sql/v257_rollback_dim_colaborador_fora_do_calculo.sql

begin;

do $$ begin
  if current_user <> 'postgres' then
    raise exception 'aplicar como postgres';
  end if;
  if to_regclass('public.dim_colaboradores') is null then
    raise exception 'dim_colaboradores não existe — a v249 é pré-requisito';
  end if;
end $$;

alter table public.dim_colaboradores
  add column if not exists sem_producao_diaria boolean not null default false,
  add column if not exists gestao              boolean not null default false;

comment on column public.dim_colaboradores.sem_producao_diaria is
  'Não tem produção diária (treinamento, atuando em outra área). Sai do FTE da equipe: vira tipoProducao=nenhuma no motor.';
comment on column public.dim_colaboradores.gestao is
  'Faz parte da gestão dos times. Mesmo efeito de sem_producao_diaria no cálculo; muda só o rótulo na tela.';

-- ── Prova dentro da própria transação ───────────────────────────────────────
do $$
declare faltando text;
begin
  select string_agg(c.col, ', ')
    into faltando
    from unnest(array['sem_producao_diaria','gestao']) c(col)
   where not exists (
     select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'dim_colaboradores'
        and column_name = c.col and data_type = 'boolean' and is_nullable = 'NO');
  if faltando is not null then
    raise exception 'coluna(s) ausente(s) ou com tipo errado: %', faltando;
  end if;

  -- Ninguém nasce fora do cálculo. O invariante é o DEFAULT da coluna, não "nenhuma linha
  -- marcada": essa segunda forma só é verdade no instante da criação e quebraria um replay
  -- do zero sobre uma base já usada — o mesmo defeito já anotado na v229.
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'dim_colaboradores'
       and column_name in ('sem_producao_diaria','gestao')
       and coalesce(column_default, '') not in ('false', 'false::boolean')
  ) then
    raise exception 'default das colunas novas não é false — gente nasceria fora do cálculo';
  end if;

  raise notice 'dim_colaboradores: sem_producao_diaria e gestao criadas (default false) em % colaborador(es); % marcado(s)',
    (select count(*) from public.dim_colaboradores),
    (select count(*) from public.dim_colaboradores where sem_producao_diaria or gestao);
end $$;


commit;
