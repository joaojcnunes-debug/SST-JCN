-- v324 — Conciliação: reabrir; Comercial: o vendedor só recebe o que está concluído (05/11/2026, 0.3.237).
--
-- REABRIR: pedido do João. O fechamento é foto imutável para o PGR (v310) e continua sendo: a
-- reabertura é outro registro (psico_conciliacao_reaberturas), com motivo. O PDF não muda. Enquanto a
-- última conciliação estiver reaberta, a empresa sai de Liberar para o Comercial e o vendedor deixa de
-- ver as intervenções, os riscos que pediram AET e o parecer. Fechar de novo cria outra foto.
--
-- SEGURANÇA: até a v323, o comercial_dados entregava a quem tem só o módulo comercial os atendimentos
-- em andamento, os rascunhos de parecer e as intervenções ainda não concluídas, e só a tela escondia.
-- Agora o filtro é no banco. A foto também sai reduzida: só os riscos e só os campos que a tela usa.
--
-- Rollback: scripts/sql/v324_conciliacao_reabrir_comercial_filtro_rollback.sql
begin;

create table if not exists public.psico_conciliacao_reaberturas (
  id_reabertura text primary key,
  id_fechamento text not null unique references public.psico_conciliacao_fechamentos(id_fechamento),
  id_empresa    text not null references public.empresas(id_empresa) on delete cascade,
  motivo        text not null check (btrim(motivo) <> ''),
  reaberto_por  text not null default lower(nullif(auth.jwt() ->> 'email', '')),
  reaberto_em   timestamptz not null default now()
);
create index if not exists ix_psico_conc_reaberturas_empresa on public.psico_conciliacao_reaberturas (id_empresa, reaberto_em desc);
comment on table public.psico_conciliacao_reaberturas is
  'Conciliação reaberta: não altera a foto do fechamento. Só inserção, como o fechamento. v324.';

drop trigger if exists trg_psico_conciliacao_reaberturas_imutavel on public.psico_conciliacao_reaberturas;
create trigger trg_psico_conciliacao_reaberturas_imutavel before update or delete on public.psico_conciliacao_reaberturas
  for each row execute function public.psico_somente_insercao();

alter table public.psico_conciliacao_reaberturas enable row level security;
drop policy if exists psico_conciliacao_reaberturas_sel on public.psico_conciliacao_reaberturas;
create policy psico_conciliacao_reaberturas_sel on public.psico_conciliacao_reaberturas
  for select to authenticated
  using (public.psico_caller_interno() and public.caller_pode_ver_empresa(id_empresa));
drop policy if exists psico_conciliacao_reaberturas_ins on public.psico_conciliacao_reaberturas;
create policy psico_conciliacao_reaberturas_ins on public.psico_conciliacao_reaberturas
  for insert to authenticated
  with check (public.caller_pode_editar() and public.caller_pode_ver_empresa(id_empresa));
revoke all on public.psico_conciliacao_reaberturas from anon, authenticated;
grant select, insert on public.psico_conciliacao_reaberturas to authenticated;

-- A última conciliação da empresa está fechada (existe e não foi reaberta).
create or replace function public.comercial_conciliacao_fechada(p_id_empresa text)
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from (
      select f.id_fechamento from public.psico_conciliacao_fechamentos f
       where f.id_empresa = p_id_empresa
       order by f.fechado_em desc limit 1
    ) u
    where not exists (select 1 from public.psico_conciliacao_reaberturas r where r.id_fechamento = u.id_fechamento)
  );
$$;
revoke execute on function public.comercial_conciliacao_fechada(text) from public, anon, authenticated;

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
        'id_empresa', v.id_empresa, 'produto', v.produto, 'observacao', v.observacao,
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
