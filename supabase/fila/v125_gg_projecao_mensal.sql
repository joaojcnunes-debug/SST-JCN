-- v125 — Gestão Gerencial: projeção mensal de substituições.
--
-- Mesma lógica do gg_sugerir_substitutos (v124), porém varrendo TODOS os dias de um
-- mês: para cada data, os slots da escala cujo titular está ausente + substitutos
-- sugeridos (mesma unidade/categoria, ativo, não ausente NAQUELE dia, sem conflito de
-- turno). Retorna uma linha por (data × slot descoberto × candidato); slot sem
-- candidato volta com id_substituto NULL. Idempotente/reversível. SECURITY INVOKER.

drop function if exists public.gg_projecao_mensal(text, int, int);

create or replace function public.gg_projecao_mensal(p_id_unidade text, p_ano int, p_mes int)
returns table (
  data             date,
  id_turno         text,
  turno_nome       text,
  id_categoria     text,
  categoria_nome   text,
  id_ausente       text,
  ausente_nome     text,
  tipo_ausencia    text,
  id_substituto    text,
  substituto_nome  text
)
language sql
stable
set search_path = public
as $$
  with dias as (
    select d::date as data
    from generate_series(
      make_date(p_ano, p_mes, 1),
      (make_date(p_ano, p_mes, 1) + interval '1 month' - interval '1 day')::date,
      interval '1 day'
    ) d
  ),
  slots as (                                               -- escala do dia-da-semana em cada data
    select dd.data, e.id_profissional, e.id_turno, t.nome as turno_nome, e.dia_semana,
           pu.id_categoria, c.nome as categoria_nome
    from dias dd
    join gg_escala_padrao e
      on e.dia_semana = extract(isodow from dd.data)::int and e.id_unidade = p_id_unidade
    join gg_turnos t on t.id = e.id_turno
    left join gg_profissional_unidades pu
      on pu.id_profissional = e.id_profissional and pu.id_unidade = e.id_unidade
    left join gg_categorias c on c.id = pu.id_categoria
  ),
  descobertos as (                                         -- titular ausente naquela data
    select s.*, p.nome as ausente_nome,
      (select a.tipo from gg_ausencias a
        where a.id_profissional = s.id_profissional
          and s.data between a.data_inicio and a.data_fim
        order by (a.tipo = 'in_loco') desc, a.data_inicio
        limit 1) as tipo_ausencia
    from slots s
    join gg_profissionais p on p.id = s.id_profissional
    where exists (
      select 1 from gg_ausencias a
      where a.id_profissional = s.id_profissional
        and s.data between a.data_inicio and a.data_fim
    )
  )
  select
    d.data, d.id_turno, d.turno_nome, d.id_categoria, d.categoria_nome,
    d.id_profissional as id_ausente, d.ausente_nome, d.tipo_ausencia,
    cand.id_substituto, cand.substituto_nome
  from descobertos d
  left join lateral (
    select cand.id_profissional as id_substituto, cp.nome as substituto_nome
    from gg_profissional_unidades cand
    join gg_profissionais cp on cp.id = cand.id_profissional and cp.ativo = true
    where cand.id_unidade = p_id_unidade
      and cand.id_categoria = d.id_categoria
      and cand.id_profissional <> d.id_profissional
      and not exists (                                     -- candidato não pode estar ausente NAQUELE dia
        select 1 from gg_ausencias a2
        where a2.id_profissional = cand.id_profissional
          and d.data between a2.data_inicio and a2.data_fim
      )
      and not exists (                                     -- sem conflito de escala (mesmo turno-nome, mesmo dia)
        select 1 from gg_escala_padrao e2
        join gg_turnos t2 on t2.id = e2.id_turno
        where e2.id_profissional = cand.id_profissional
          and e2.dia_semana = d.dia_semana
          and lower(t2.nome) = lower(d.turno_nome)
      )
  ) cand on true
  order by d.data, d.turno_nome, d.ausente_nome, cand.substituto_nome nulls last;
$$;

grant execute on function public.gg_projecao_mensal(text, int, int) to authenticated;
