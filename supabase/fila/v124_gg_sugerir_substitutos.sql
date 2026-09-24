-- v124 — Gestão Gerencial: RPC de verificação de substituição.
--
-- Dado uma UNIDADE e uma DATA, retorna os "slots" da escala padrão daquele dia
-- da semana cujo titular está AUSENTE na data (folga/férias/atestado/falta/in_loco)
-- e, para cada um, os possíveis SUBSTITUTOS: profissionais da MESMA unidade e MESMA
-- categoria, ativos, não ausentes e sem conflito de escala (não escalados em turno
-- de mesmo nome, no mesmo dia da semana, em qualquer unidade).
--
-- Slot sem substituto disponível volta uma linha com id_substituto NULL (LEFT LATERAL),
-- para a UI mostrar "sem substituto". Idempotente/reversível (create or replace + drop).
-- SECURITY INVOKER: a RLS interna das gg_* já libera SELECT a authenticated.

drop function if exists public.gg_sugerir_substitutos(text, date);

create or replace function public.gg_sugerir_substitutos(p_id_unidade text, p_data date)
returns table (
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
  with dia as (
    select extract(isodow from p_data)::int as d          -- 1=Seg … 7=Dom
  ),
  ausente as (                                             -- ausentes na data
    select distinct id_profissional
    from gg_ausencias
    where p_data between data_inicio and data_fim
  ),
  slots as (                                               -- escala do dia nesta unidade
    select e.id_profissional, e.id_turno, t.nome as turno_nome, e.dia_semana,
           pu.id_categoria, c.nome as categoria_nome
    from gg_escala_padrao e
    join dia on e.dia_semana = dia.d
    join gg_turnos t on t.id = e.id_turno
    left join gg_profissional_unidades pu
      on pu.id_profissional = e.id_profissional and pu.id_unidade = e.id_unidade
    left join gg_categorias c on c.id = pu.id_categoria
    where e.id_unidade = p_id_unidade
  ),
  descobertos as (                                         -- titular ausente → precisa cobrir
    select s.*, p.nome as ausente_nome,
      (select a.tipo from gg_ausencias a
        where a.id_profissional = s.id_profissional
          and p_data between a.data_inicio and a.data_fim
        order by (a.tipo = 'in_loco') desc, a.data_inicio
        limit 1) as tipo_ausencia
    from slots s
    join gg_profissionais p on p.id = s.id_profissional
    where s.id_profissional in (select id_profissional from ausente)
  )
  select
    d.id_turno, d.turno_nome, d.id_categoria, d.categoria_nome,
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
      and cand.id_profissional not in (select id_profissional from ausente)
      and not exists (                                     -- sem conflito de escala (mesmo turno-nome, mesmo dia)
        select 1 from gg_escala_padrao e2
        join gg_turnos t2 on t2.id = e2.id_turno
        where e2.id_profissional = cand.id_profissional
          and e2.dia_semana = d.dia_semana
          and lower(t2.nome) = lower(d.turno_nome)
      )
  ) cand on true
  order by d.turno_nome, d.ausente_nome, cand.substituto_nome nulls last;
$$;

grant execute on function public.gg_sugerir_substitutos(text, date) to authenticated;
