-- v321 — Comercial › Liberar serviços (05/11/2026, 0.3.233).
--
-- Até aqui a liberação era do documento inteiro: liberar uma inspeção soltava todas as
-- oportunidades dela. Agora a equipe decide serviço por serviço, por empresa:
--   • comercial_liberacoes       — a decisão vigente de cada empresa × serviço
--                                  (LIBERADO, com modalidades e orientação; SEGURADO, com motivo);
--   • comercial_decidir          — grava a decisão de um ou mais serviços da empresa;
--   • comercial_desfazer_decisao — volta o serviço para a fila;
--   • comercial_corte_fila       — o instante em que esta migração rodou. O que já estava liberado
--                                  antes dele continua aparecendo para o vendedor sem nova decisão
--                                  (decisão do João em 05/11/2026);
--   • comercial_dados            — igual à v270, mais as chaves `liberacoes` e `corte`.
--
-- O botão da inspeção e da AEP continua gravando liberado_comercial_em; a partir de agora ele
-- manda os serviços para a fila. Regra em lib/comercial/liberacao.ts.
-- Quem decide: caller_pode_editar() (Admin e Técnico ativos), a mesma regra de quem edita.
-- Rollback: scripts/sql/v321_comercial_liberacoes_rollback.sql
begin;

create table if not exists public.comercial_liberacoes (
  id_empresa   text not null references public.empresas(id_empresa) on delete cascade,
  produto      text not null check (produto in (
                 'AET', 'DRPS/Questionário', 'Apreciação NR-12', 'Medição quantitativa',
                 'Análise de Químicos', 'Treinamentos NR')),
  status       text not null check (status in ('LIBERADO', 'SEGURADO')),
  modalidades  text[] not null default '{}'
                 check (modalidades <@ array['EAD', 'Presencial', 'Ao vivo']::text[]),
  orientacao   text,
  motivo       text,
  decidido_por text,
  decidido_em  timestamptz not null default now(),
  primary key (id_empresa, produto),
  constraint comercial_liberacoes_motivo_segurado
    check (status <> 'SEGURADO' or nullif(btrim(motivo), '') is not null)
);
comment on table public.comercial_liberacoes is
  'Decisão vigente da equipe sobre cada serviço indicado (empresa × produto). Vale até o documento de origem ser reenviado. Sem linha: serviço na fila, ou já liberado antes da fila (comercial_corte_fila).';

alter table public.comercial_liberacoes enable row level security;
drop policy if exists "comercial_liberacoes leitura" on public.comercial_liberacoes;
create policy "comercial_liberacoes leitura" on public.comercial_liberacoes
  for select to authenticated using (public.caller_pode_editar());
-- Escrita só pelas RPCs abaixo.
revoke insert, update, delete on public.comercial_liberacoes from anon, authenticated;

-- Grava o instante desta migração dentro da função. Reaplicar o script não pode mover o corte,
-- por isso o create só roda se a função ainda não existir.
do $do$
begin
  if to_regprocedure('public.comercial_corte_fila()') is null then
    execute format(
      'create function public.comercial_corte_fila() returns timestamptz language sql immutable as $f$ select %L::timestamptz $f$',
      now());
  end if;
end $do$;
revoke execute on function public.comercial_corte_fila() from public, anon, authenticated;

create or replace function public.comercial_decidir(
  p_id_empresa text,
  p_produtos text[],
  p_status text,
  p_modalidades text[] default '{}',
  p_orientacao text default null,
  p_motivo text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_nome text;
begin
  if not public.caller_pode_editar() then
    raise exception 'Sem permissão para liberar serviços ao Comercial' using errcode = '42501';
  end if;
  if coalesce(array_length(p_produtos, 1), 0) = 0 then
    raise exception 'Escolha ao menos um serviço' using errcode = '22023';
  end if;
  select coalesce(nullif(btrim(u.nome), ''), u.email) into v_nome
    from public.usuarios u where lower(u.email) = lower(auth.jwt() ->> 'email') limit 1;

  insert into public.comercial_liberacoes
    (id_empresa, produto, status, modalidades, orientacao, motivo, decidido_por, decidido_em)
  select p_id_empresa, p, p_status,
         case when p_status = 'LIBERADO' then coalesce(p_modalidades, '{}') else '{}' end,
         case when p_status = 'LIBERADO' then nullif(btrim(p_orientacao), '') end,
         case when p_status = 'SEGURADO' then nullif(btrim(p_motivo), '') end,
         v_nome, now()
    from unnest(p_produtos) as p
  on conflict (id_empresa, produto) do update set
    status = excluded.status,
    modalidades = excluded.modalidades,
    orientacao = excluded.orientacao,
    motivo = excluded.motivo,
    decidido_por = excluded.decidido_por,
    decidido_em = excluded.decidido_em;
end $$;
revoke execute on function public.comercial_decidir(text, text[], text, text[], text, text) from public, anon;
grant execute on function public.comercial_decidir(text, text[], text, text[], text, text) to authenticated;

create or replace function public.comercial_desfazer_decisao(p_id_empresa text, p_produto text)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.caller_pode_editar() then
    raise exception 'Sem permissão para liberar serviços ao Comercial' using errcode = '42501';
  end if;
  delete from public.comercial_liberacoes where id_empresa = p_id_empresa and produto = p_produto;
end $$;
revoke execute on function public.comercial_desfazer_decisao(text, text) from public, anon;
grant execute on function public.comercial_desfazer_decisao(text, text) to authenticated;

create or replace function public.comercial_dados()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_ok boolean;
begin
  select (u.perfil = 'Admin' or u.modulos_permitidos is null or 'comercial' = any(u.modulos_permitidos))
    into v_ok
    from public.usuarios u
   where lower(u.email) = v_email and u.ativo_sistema = true
   limit 1;
  if not coalesce(v_ok, false) then
    raise exception 'Sem permissão para o módulo Comercial' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'aeps', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_relatorio', a.id_relatorio,
        'id_empresa', a.id_empresa,
        'status', a.status,
        'setores', a.setores,
        'responsavel_elaboracao', a.responsavel_elaboracao,
        'data_elaboracao', a.data_elaboracao,
        'id_inspecao', a.id_inspecao,
        'entregue_em', case when a.id_inspecao is not null then i.elaboracao_concluida_em else a.concluido_em end,
        'enviado_por', i.elaboracao_responsavel,
        'liberado_comercial_em', a.liberado_comercial_em,
        'liberado_comercial_por', a.liberado_comercial_por,
        'empresas', jsonb_build_object(
          'nome_empresa', e.nome_empresa, 'cnpj', e.cnpj, 'municipio', e.municipio, 'uf', e.uf,
          'id_unidade', e.id_unidade, 'telefone', e.telefone, 'email', e.email)))
        from public.aep_relatorios a
        join public.empresas e on e.id_empresa = a.id_empresa
        left join public.inspecoes i on i.id_inspecao = a.id_inspecao
       where a.liberado_comercial_em is not null
         and ((a.id_inspecao is not null and i.elaboracao_status = 'CONCLUIDO' and i.status <> 'DELETADA')
           or (a.id_inspecao is null and a.status = 'CONCLUIDO'))
    ), '[]'::jsonb),
    'inspecoes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_inspecao', i.id_inspecao,
        'id_empresa', i.id_empresa,
        'concluida_em', coalesce(i.concluida_em, i.updated_at),
        'responsavel', i.responsavel,
        'liberado_comercial_em', i.liberado_comercial_em,
        'liberado_comercial_por', i.liberado_comercial_por,
        'empresas', jsonb_build_object(
          'nome_empresa', e.nome_empresa, 'cnpj', e.cnpj, 'municipio', e.municipio, 'uf', e.uf,
          'id_unidade', e.id_unidade, 'telefone', e.telefone, 'email', e.email),
        'maquinas', coalesce((
          select jsonb_agg(jsonb_build_object('nome', m.nome, 'grau_risco', m.grau_risco, 'adequacao', m.necessita_adequacao_nr12))
            from public.inspecao_maquinas m
           where m.id_inspecao = i.id_inspecao and m.ativo is not false
             and (m.necessita_adequacao_nr12 or m.grau_risco in ('ALTO', 'CRITICO'))), '[]'::jsonb),
        'medicoes', coalesce((
          select jsonb_agg(jsonb_build_object('agente', r.agente, 'qual', r.fisico_qual_medicao, 'setor', s.setor_ghe))
            from public.riscos r left join public.setores s on s.id_setor = r.id_setor
           where r.id_inspecao = i.id_inspecao and r.tipo_risco = 'Físico' and r.fisico_necessita_medicao = 'Sim'), '[]'::jsonb),
        'quimicos', coalesce((
          select jsonb_agg(distinct coalesce(nullif(trim(r.agente), ''), 'Agente químico'))
            from public.riscos r where r.id_inspecao = i.id_inspecao and r.tipo_risco = 'Químico'), '[]'::jsonb),
        'ergonomicos', (select count(*) from public.riscos r where r.id_inspecao = i.id_inspecao and r.tipo_risco = 'Ergonômico'),
        'psicossociais', (select count(*) from public.riscos r where r.id_inspecao = i.id_inspecao and r.tipo_risco = 'Psicossocial'),
        'treinamentos', coalesce((
          select jsonb_agg(jsonb_build_object('nr', t.nr, 'titulo', t.titulo) order by t.ordem)
            from public.treinamentos_nr t where t.id_inspecao = i.id_inspecao and t.ativo is not false), '[]'::jsonb)))
        from (
          select distinct on (x.id_empresa) x.*
            from public.inspecoes x
           where x.status = 'CONCLUIDA' and x.liberado_comercial_em is not null
           order by x.id_empresa, coalesce(x.concluida_em, x.updated_at) desc nulls last
        ) i
        join public.empresas e on e.id_empresa = i.id_empresa
    ), '[]'::jsonb),
    'docs', coalesce((
      select jsonb_agg(jsonb_build_object('id_empresa', d.id_empresa, 'tipo', d.tipo, 'status', d.status, 'data', d.data))
        from (
          select id_empresa, 'DRPS'::text as tipo, status,
                 coalesce(data_envio_cliente::timestamptz, data_conclusao::timestamptz, data_elaboracao::timestamptz, updated_at) as data
            from public.drps_relatorios
          union all select id_empresa, 'QPS', status, coalesce(data_elaboracao::timestamptz, atualizado_em) from public.qps_aplicacoes
          union all select id_empresa, 'AET', status, coalesce(updated_at, created_at) from public.aet_relatorios
          union all select id_empresa, 'AEP', status, coalesce(concluido_em, updated_at, created_at) from public.aep_relatorios
          union all select id_empresa, 'APRECIACAO', status, coalesce(finalizado_em, updated_at, created_at) from public.apreciacoes_maquinas
          union all select id_empresa, 'QUIMICOS', 'CONCLUIDO', coalesce(updated_at, created_at) from public.analises_quimicos
        ) d
       where d.id_empresa is not null
    ), '[]'::jsonb),
    'certificados', coalesce((
      select jsonb_agg(distinct jsonb_build_object('id_empresa', c.id_empresa, 'nr', c.nr))
        from public.certificados_treinamento c where c.id_empresa is not null
    ), '[]'::jsonb),
    'liberacoes', coalesce((
      select jsonb_agg(to_jsonb(l)) from public.comercial_liberacoes l
    ), '[]'::jsonb),
    'corte', public.comercial_corte_fila()
  );
end $$;

commit;
