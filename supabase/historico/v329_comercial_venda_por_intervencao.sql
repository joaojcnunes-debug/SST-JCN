-- v329 — Comercial: venda por intervenção psicossocial (09/11/2026, 0.3.247).
--
-- Pedido do João: na tabela das intervenções psicossociais do vendedor, cada intervenção tem a sua
-- Situação e o seu "Marcar como vendido". A venda ganha id_item (a linha de
-- comercial_atendimento_intervencoes); '' é a venda do serviço inteiro, como era até a v323.
-- A chave passa a ser (id_empresa, produto, id_item). As vendas que já existem continuam iguais.
-- comercial_dados() devolve o id_item; o resto da função é o da v324, sem mudança.
--
-- Rollback: scripts/sql/v329_comercial_venda_por_intervencao_rollback.sql
begin;

alter table public.comercial_vendas add column if not exists id_item text not null default '';
comment on column public.comercial_vendas.id_item is
  'Intervenção psicossocial vendida (comercial_atendimento_intervencoes.id_item). Vazio = o serviço inteiro. v329.';
alter table public.comercial_vendas drop constraint if exists comercial_vendas_pkey;
alter table public.comercial_vendas add constraint comercial_vendas_pkey primary key (id_empresa, produto, id_item);

drop function if exists public.comercial_venda_registrar(text, text, text);
drop function if exists public.comercial_venda_desfazer(text, text);

create or replace function public.comercial_venda_registrar(
  p_id_empresa text, p_produto text, p_observacao text default null, p_id_item text default null)
  returns void language plpgsql security definer set search_path = public as $$
declare
  u record;
  v_item text := coalesce(btrim(p_id_item), '');
begin
  select coalesce(nullif(btrim(x.nome), ''), x.email) as nome, lower(x.email) as email into u
    from public.usuarios x
   where lower(x.email) = lower(auth.jwt() ->> 'email') and x.ativo_sistema = true
     and (x.perfil = 'Admin' or x.modulos_permitidos is null or 'comercial' = any(x.modulos_permitidos))
   limit 1;
  if u.email is null then
    raise exception 'Sem permissão para registrar a venda' using errcode = '42501';
  end if;
  -- Venda de uma intervenção: só psicossocial, e a intervenção tem de ser da empresa.
  if v_item <> '' and (p_produto <> 'Intervenção psicossocial' or not exists (
       select 1 from public.comercial_atendimento_intervencoes i
        where i.id_item = v_item and i.id_empresa = p_id_empresa)) then
    raise exception 'Intervenção não encontrada nesta empresa' using errcode = '22023';
  end if;
  insert into public.comercial_vendas (id_empresa, produto, id_item, observacao, vendido_por, vendido_por_email)
  values (p_id_empresa, p_produto, v_item, nullif(btrim(p_observacao), ''), u.nome, u.email)
  on conflict (id_empresa, produto, id_item) do update set
    observacao = excluded.observacao,
    vendido_por = excluded.vendido_por,
    vendido_por_email = excluded.vendido_por_email,
    vendido_em = now();
end $$;

create or replace function public.comercial_venda_desfazer(p_id_empresa text, p_produto text, p_id_item text default null)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  v_admin boolean;
begin
  select exists (select 1 from public.usuarios x where lower(x.email) = v_email and x.ativo_sistema = true and x.perfil = 'Admin') into v_admin;
  delete from public.comercial_vendas
   where id_empresa = p_id_empresa and produto = p_produto and id_item = coalesce(btrim(p_id_item), '')
     and (v_admin or vendido_por_email = v_email);
  if not found then
    raise exception 'Só quem registrou a venda, ou um Admin, pode desfazer' using errcode = '42501';
  end if;
end $$;

revoke execute on function public.comercial_venda_registrar(text, text, text, text) from public, anon;
grant execute on function public.comercial_venda_registrar(text, text, text, text) to authenticated;
revoke execute on function public.comercial_venda_desfazer(text, text, text) from public, anon;
grant execute on function public.comercial_venda_desfazer(text, text, text) to authenticated;

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
  -- Quem libera vê o trabalho em andamento. O vendedor só recebe o que está concluído.
  v_libera boolean := public.comercial_pode_liberar();
begin
  select (u.perfil = 'Admin' or u.modulos_permitidos is null or 'comercial' = any(u.modulos_permitidos)
          or 'consolidacao_psicossocial' = any(u.modulos_permitidos))
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
    'atendimentos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_empresa', t.id_empresa, 'status', t.status, 'parecer', t.parecer,
        'concluido_em', t.concluido_em, 'concluido_por', t.concluido_por,
        'empresas', jsonb_build_object(
          'nome_empresa', e.nome_empresa, 'cnpj', e.cnpj, 'municipio', e.municipio, 'uf', e.uf,
          'id_unidade', e.id_unidade, 'telefone', e.telefone, 'email', e.email)))
        from public.comercial_atendimentos t
        join public.empresas e on e.id_empresa = t.id_empresa
       where v_libera or (t.status = 'CONCLUIDO' and public.comercial_conciliacao_fechada(t.id_empresa))
    ), '[]'::jsonb),
    'intervencoes', coalesce((
      select jsonb_agg(to_jsonb(x)) from public.comercial_atendimento_intervencoes x
       where v_libera or exists (
         select 1 from public.comercial_atendimentos t
          where t.id_empresa = x.id_empresa and t.status = 'CONCLUIDO'
            and public.comercial_conciliacao_fechada(t.id_empresa))
    ), '[]'::jsonb),
    'vendas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_empresa', v.id_empresa, 'produto', v.produto, 'id_item', v.id_item, 'observacao', v.observacao,
        'vendido_por', v.vendido_por, 'vendido_por_email', v.vendido_por_email, 'vendido_em', v.vendido_em,
        'nome_empresa', e.nome_empresa, 'cnpj', e.cnpj, 'municipio', e.municipio, 'uf', e.uf))
        from public.comercial_vendas v
        join public.empresas e on e.id_empresa = v.id_empresa
    ), '[]'::jsonb),
    'conciliacoes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_fechamento', f.id_fechamento, 'id_empresa', f.id_empresa, 'fechado_em', f.fechado_em,
        'fechado_por', f.fechado_por,
        -- Só os riscos e só o que a tela usa: o resto da foto (justificativa, níveis) é da equipe.
        'itens', coalesce((
          select jsonb_agg(jsonb_build_object(
            'setor', it ->> 'setor', 'setor_chave', it ->> 'setor_chave', 'id_fator', it ->> 'id_fator',
            'fator', it ->> 'fator', 'questionario', it ->> 'questionario', 'decisao', it ->> 'decisao'))
            from jsonb_array_elements(f.itens) it
           where it ->> 'decisao' in ('CONFIRMAR', 'AET')
        ), '[]'::jsonb),
        'empresas', jsonb_build_object(
          'nome_empresa', e.nome_empresa, 'cnpj', e.cnpj, 'municipio', e.municipio, 'uf', e.uf,
          'id_unidade', e.id_unidade, 'telefone', e.telefone, 'email', e.email)))
        from (
          select distinct on (x.id_empresa) x.*
            from public.psico_conciliacao_fechamentos x
           order by x.id_empresa, x.fechado_em desc
        ) f
        join public.empresas e on e.id_empresa = f.id_empresa
       where public.comercial_conciliacao_fechada(f.id_empresa)
         and (v_libera or exists (
           select 1 from public.comercial_atendimentos t
            where t.id_empresa = f.id_empresa and t.status = 'CONCLUIDO'))
    ), '[]'::jsonb)
  );
end $$;

notify pgrst, 'reload schema';

commit;
