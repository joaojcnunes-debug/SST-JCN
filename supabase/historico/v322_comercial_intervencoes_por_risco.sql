-- v322 — Liberar para o Comercial só com o que veio da Conciliação (05/11/2026, 0.3.235).
--
-- Pedido do João depois de ver a tela da v321: a página mostra só o que a Conciliação identificou,
-- e as intervenções ficam por risco, com Intervenção, Modalidade, Responsável e Prazo editáveis.
--
--   • Riscos: os pareceres Confirmar e Aprofundar com AET da ÚLTIMA conciliação FECHADA de cada
--     empresa (psico_conciliacao_fechamentos.itens), um por setor × fator.
--   • comercial_atendimento_intervencoes: refeita, várias por risco; prazo em dias.
--   • Inspeção e AEP voltam a liberar direto para o vendedor, como antes da v321: comercial_liberacoes,
--     comercial_decidir, comercial_desfazer_decisao e comercial_corte_fila saem.
--   • comercial_dados: sai `liberacoes` e `corte`; entra `conciliacoes`.
--
-- As linhas apagadas (comercial_liberacoes e a intervenção antiga) eram só do teste de 05/11 na
-- empresa Teste. Atendimentos, sessões, eventos e o catálogo continuam.
-- Rollback: scripts/sql/v322_comercial_intervencoes_por_risco_rollback.sql
begin;

drop function if exists public.comercial_decidir(text, text[], text, text[], text, text);
drop function if exists public.comercial_desfazer_decisao(text, text);
drop function if exists public.comercial_intervencao_indicar(text, text, text[], text);
drop function if exists public.comercial_intervencao_retirar(text, text);
drop table if exists public.comercial_liberacoes;
drop table if exists public.comercial_atendimento_intervencoes;

create table public.comercial_atendimento_intervencoes (
  id_item        text primary key default ('CAI-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  id_empresa     text not null references public.comercial_atendimentos(id_empresa) on delete cascade,
  setor_chave    text not null,
  setor_nome     text not null,
  id_fator       text not null,
  fator_nome     text not null,
  id_intervencao text,
  nome           text not null check (nullif(btrim(nome), '') is not null),
  modalidade     text check (modalidade is null or modalidade in ('EAD', 'Presencial', 'Ao vivo')),
  responsavel    text,
  prazo_dias     integer check (prazo_dias is null or prazo_dias > 0),
  decidido_por   text,
  decidido_em    timestamptz not null default now()
);
create index ix_comercial_interv_empresa on public.comercial_atendimento_intervencoes (id_empresa, setor_chave, id_fator);
comment on table public.comercial_atendimento_intervencoes is
  'Intervenções indicadas por risco (setor × fator da conciliação fechada). O nome fica gravado: excluir do catálogo não apaga o que foi indicado.';

alter table public.comercial_atendimento_intervencoes enable row level security;
create policy comercial_atendimento_intervencoes_leitura on public.comercial_atendimento_intervencoes
  for select to authenticated using (public.comercial_pode_liberar());
revoke insert, update, delete on public.comercial_atendimento_intervencoes from anon, authenticated;

-- Insere (p_id_item nulo) ou altera uma linha. Devolve o id.
create function public.comercial_intervencao_salvar(
  p_id_item text,
  p_id_empresa text,
  p_setor_chave text,
  p_setor_nome text,
  p_id_fator text,
  p_fator_nome text,
  p_id_intervencao text,
  p_nome text,
  p_modalidade text,
  p_responsavel text,
  p_prazo_dias integer
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_nome text;
  v_id text;
begin
  v_nome := public.comercial_exige_sessao(p_id_empresa);
  if p_id_item is null then
    insert into public.comercial_atendimento_intervencoes
      (id_empresa, setor_chave, setor_nome, id_fator, fator_nome, id_intervencao, nome, modalidade, responsavel, prazo_dias, decidido_por)
    values (p_id_empresa, p_setor_chave, p_setor_nome, p_id_fator, p_fator_nome, p_id_intervencao, btrim(p_nome),
            nullif(p_modalidade, ''), nullif(btrim(p_responsavel), ''), p_prazo_dias, v_nome)
    returning id_item into v_id;
  else
    update public.comercial_atendimento_intervencoes
       set id_intervencao = p_id_intervencao, nome = btrim(p_nome), modalidade = nullif(p_modalidade, ''),
           responsavel = nullif(btrim(p_responsavel), ''), prazo_dias = p_prazo_dias,
           decidido_por = v_nome, decidido_em = now()
     where id_item = p_id_item and id_empresa = p_id_empresa
     returning id_item into v_id;
    if v_id is null then
      raise exception 'Intervenção não encontrada neste atendimento' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end $$;

create function public.comercial_intervencao_retirar(p_id_empresa text, p_id_item text)
  returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.comercial_exige_sessao(p_id_empresa);
  delete from public.comercial_atendimento_intervencoes where id_empresa = p_id_empresa and id_item = p_id_item;
end $$;

revoke execute on function public.comercial_intervencao_salvar(text, text, text, text, text, text, text, text, text, text, integer) from public, anon;
grant execute on function public.comercial_intervencao_salvar(text, text, text, text, text, text, text, text, text, text, integer) to authenticated;
revoke execute on function public.comercial_intervencao_retirar(text, text) from public, anon;
grant execute on function public.comercial_intervencao_retirar(text, text) to authenticated;

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
    ), '[]'::jsonb),
    'intervencoes', coalesce((
      select jsonb_agg(to_jsonb(x)) from public.comercial_atendimento_intervencoes x
    ), '[]'::jsonb),
    'conciliacoes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_fechamento', f.id_fechamento, 'id_empresa', f.id_empresa, 'fechado_em', f.fechado_em,
        'fechado_por', f.fechado_por, 'itens', f.itens,
        'empresas', jsonb_build_object(
          'nome_empresa', e.nome_empresa, 'cnpj', e.cnpj, 'municipio', e.municipio, 'uf', e.uf,
          'id_unidade', e.id_unidade, 'telefone', e.telefone, 'email', e.email)))
        from (
          select distinct on (x.id_empresa) x.*
            from public.psico_conciliacao_fechamentos x
           order by x.id_empresa, x.fechado_em desc
        ) f
        join public.empresas e on e.id_empresa = f.id_empresa
    ), '[]'::jsonb)
  );
end $$;

-- Só depois do comercial_dados novo, que já não usa o corte.
drop function if exists public.comercial_corte_fila();

commit;
