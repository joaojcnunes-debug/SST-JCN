-- v296 (JCN) — dashboard_reaberturas corrigida (simulação de 26/10/2026). Aplicada em 26/10.
--
-- Dois defeitos achados na simulação ponta a ponta da v295:
--  1. A janela da reabertura era pelo HORÁRIO (`ocorrido_em`, que é now() = início da transação).
--     Reabrir, alterar e concluir de novo na mesma transação/instante empatava: a lista vinha vazia e
--     a reconclusão não era achada. Agora é pela SEQUÊNCIA da auditoria (`id`, bigserial).
--  2. Alteração em aba (setor, risco, foto…) não aparecia: nas EDIÇÕES a auditoria guarda só os
--     campos alterados, sem `id_inspecao`. Agora o evento é ligado à inspeção pela CHAVE do registro
--     (registro_id) dos itens que pertencem a ela; criações/exclusões continuam pelo `id_inspecao` que
--     vem no registro completo.
--  + O campo que é a própria reabertura/reconclusão (status / elaboracao_status) sai da lista; os
--    demais campos alterados no mesmo evento da reabertura entram.
--  + Índice (tabela, registro_id, id) para a busca não varrer a auditoria.
--
-- REAPLICAR: idempotente. ROLLBACK: reaplicar a função da v295 e
--   drop index if exists public.auditoria_eventos_tab_reg_id_idx;

create index if not exists auditoria_eventos_tab_reg_id_idx
  on public.auditoria_eventos (tabela, registro_id, id);

create or replace function public.dashboard_reaberturas(p_tipo text default 'inspecao')
  returns table (id_inspecao text, reaberta_em timestamptz, reaberta_por text,
                 reconcluida_em timestamptz, alteracoes jsonb)
  language plpgsql stable security definer set search_path = public as $$
declare
  v_campo text := case when p_tipo = 'documento' then 'elaboracao_status' else 'status' end;
  v_valor text := case when p_tipo = 'documento' then 'CONCLUIDO' else 'CONCLUIDA' end;
begin
  if not public.dashboard_caller_interno() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  return query
  with reab as (
    select e.id as rid, e.registro_id as id, e.ocorrido_em as em, lower(e.usuario_email) as por
      from public.auditoria_eventos e
     where e.tabela = 'inspecoes'
       and e.antes ->> v_campo = v_valor
       and coalesce(e.depois ->> v_campo, '') <> v_valor
  ), janela as (
    select r.rid, r.id, r.em, r.por, f.fid, f.fem
      from reab r
      left join lateral (
        select e2.id as fid, e2.ocorrido_em as fem
          from public.auditoria_eventos e2
         where e2.tabela = 'inspecoes' and e2.registro_id = r.id and e2.id > r.rid
           and e2.depois ->> v_campo = v_valor
           and coalesce(e2.antes ->> v_campo, '') <> v_valor
         order by e2.id
         limit 1
      ) f on true
  )
  select j.id, j.em, j.por, j.fem,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'tabela', ev.tabela, 'acao', ev.acao, 'campo', c.campo,
                    'antes', ev.antes -> c.campo, 'depois', ev.depois -> c.campo,
                    'por', lower(ev.usuario_email), 'em', ev.ocorrido_em, 'titulo', ev.titulo)
                  order by ev.id)
             from (
               -- itens que pertencem à inspeção hoje (edições: ligados pela chave do registro)
               select a.id, a.tabela, a.acao, a.campos_alterados, a.antes, a.depois, a.usuario_email, a.ocorrido_em, a.titulo
                 from (
                   select 'inspecoes'::text as tabela, j.id::text as reg
                   union all select 'setores', s.id_setor::text from public.setores s where s.id_inspecao = j.id
                   union all select 'riscos', r2.id_risco::text from public.riscos r2 where r2.id_inspecao = j.id
                   union all select 'fotos', f2.id_foto::text from public.fotos f2 where f2.id_inspecao = j.id
                   union all select 'extintores', x.id_extintor::text from public.extintores x where x.id_inspecao = j.id
                   union all select 'inspecao_maquinas', m.id_maquina_inspecao::text from public.inspecao_maquinas m where m.id_inspecao = j.id
                   union all select 'inspecao_maquinas_setores', ms.id_maquina_inspecao::text || '|' || ms.id_setor::text
                               from public.inspecao_maquinas_setores ms
                               join public.inspecao_maquinas m2 on m2.id_maquina_inspecao = ms.id_maquina_inspecao
                              where m2.id_inspecao::text = j.id
                   union all select 'responsaveis', rp.id_responsavel::text from public.responsaveis rp where rp.id_inspecao = j.id
                   union all select 'inspecao_associados', ia.id::text from public.inspecao_associados ia where ia.id_inspecao = j.id
                 ) alvo
                 join public.auditoria_eventos a
                   on a.tabela = alvo.tabela and a.registro_id = alvo.reg
                  and a.id >= j.rid and (j.fid is null or a.id <= j.fid)
               union
               -- criações e exclusões (o registro completo traz o id_inspecao; o excluído não está mais na aba)
               select a.id, a.tabela, a.acao, a.campos_alterados, a.antes, a.depois, a.usuario_email, a.ocorrido_em, a.titulo
                 from public.auditoria_eventos a
                where a.tabela in ('setores','riscos','fotos','extintores','inspecao_maquinas',
                                   'responsaveis','inspecao_associados')
                  and a.id >= j.rid and (j.fid is null or a.id <= j.fid)
                  and coalesce(a.depois ->> 'id_inspecao', a.antes ->> 'id_inspecao') = j.id
             ) ev
             cross join lateral (
               select unnest(case when coalesce(cardinality(ev.campos_alterados), 0) > 0
                                  then ev.campos_alterados else array['(registro)'] end) as campo
             ) c
            where c.campo <> v_campo
              and c.campo not in ('updated_at','created_at','concluida_em','concluida_por_email',
                                  'elaboracao_concluida_em','liberado_comercial_em','liberado_comercial_por',
                                  'primeira_conclusao_em','primeira_conclusao_por',
                                  'primeira_elaboracao_em','primeira_elaboracao_por')
         ), '[]'::jsonb)
    from janela j
    join public.inspecoes i on i.id_inspecao = j.id
   where (p_tipo = 'documento' and i.primeira_elaboracao_em is not null and j.em >= i.primeira_elaboracao_em)
      or (p_tipo <> 'documento' and i.primeira_conclusao_em is not null and j.em >= i.primeira_conclusao_em)
   order by j.rid desc;
end $$;
revoke all on function public.dashboard_reaberturas(text) from public, anon;
grant execute on function public.dashboard_reaberturas(text) to authenticated, service_role;

notify pgrst, 'reload schema';
