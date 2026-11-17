-- v361 — Grupos de empresas: escolher as empresas e os documentos que entram (17/11/2026, 0.3.297).
--
-- POR QUÊ: pedido do João. Na Consolidação de Grupo › Fontes, uma marca na frente de cada empresa para tirá-la da
-- consolidação e do relatório; e a Conciliação por grupo passa a usar o que foi escolhido nos Grupos de empresas.
-- Até aqui a escolha dos documentos ficava só na tela (voltava ao padrão ao recarregar) e a conciliação pegava sempre
-- o mais recente de cada empresa.
--
-- O QUE FAZ:
--   empresa_grupos.psico_empresas_fora text[]  empresas desmarcadas (fora da consolidação, do relatório e da
--                                             conciliação do grupo).
--   empresa_grupos.psico_documentos jsonb      {id_empresa: [ids dos documentos marcados]}; empresa que não está aqui
--                                             usa o padrão (o mais recente de cada tipo) — documento ou empresa nova
--                                             entra sozinha. {} = tudo no padrão.
--   comercial_dados(): o Comercial do grupo cobre só as empresas da foto do último fechamento da conciliação do grupo
--                      (antes: todas as empresas do grupo). O resto da função não muda.
--   Gravação pela mesma política de UPDATE de empresa_grupos (como psico_fatores_ignorados). Nenhum dado muda.
--
-- REAPLICAR: idempotente. ROLLBACK: scripts/sql/v361_grupo_selecao_empresas_documentos_rollback.sql
begin;

alter table public.empresa_grupos
  add column if not exists psico_empresas_fora text[] not null default '{}',
  add column if not exists psico_documentos jsonb not null default '{}'::jsonb;
comment on column public.empresa_grupos.psico_empresas_fora is
  'v361: empresas do grupo que ficam fora da Consolidação, do relatório e da Conciliação por grupo.';
comment on column public.empresa_grupos.psico_documentos is
  'v361: {id_empresa: [ids dos documentos escolhidos na aba Fontes]}; empresa ausente usa o padrão (mais recente de cada tipo).';

CREATE OR REPLACE FUNCTION public.comercial_dados()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_ok boolean;
  -- Quem libera vÃª o trabalho em andamento. O vendedor sÃ³ recebe o que estÃ¡ concluÃ­do.
  v_libera boolean := public.comercial_pode_liberar();
begin
  select (u.perfil = 'Admin' or u.modulos_permitidos is null or 'comercial' = any(u.modulos_permitidos)
          or 'consolidacao_psicossocial' = any(u.modulos_permitidos))
    into v_ok
    from public.usuarios u
   where lower(u.email) = v_email and u.ativo_sistema = true
   limit 1;
  if not coalesce(v_ok, false) then
    raise exception 'Sem permissÃ£o para o mÃ³dulo Comercial' using errcode = '42501';
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
          -- v331: os setores da mÃ¡quina vÃªm da ligaÃ§Ã£o da v160 (inspecao_maquinas.id_setor ficou congelado).
          select jsonb_agg(jsonb_build_object('nome', m.nome, 'grau_risco', m.grau_risco, 'adequacao', m.necessita_adequacao_nr12,
                                              'setores', coalesce((
                                                select jsonb_agg(distinct sm.setor_ghe)
                                                  from public.inspecao_maquinas_setores ims
                                                  join public.setores sm on sm.id_setor = ims.id_setor
                                                 where ims.id_maquina_inspecao = m.id_maquina_inspecao
                                                   and nullif(btrim(sm.setor_ghe), '') is not null), '[]'::jsonb)))
            from public.inspecao_maquinas m
           where m.id_inspecao = i.id_inspecao and m.ativo is not false
             and (m.necessita_adequacao_nr12 or m.grau_risco in ('ALTO', 'CRITICO'))), '[]'::jsonb),
        'medicoes', coalesce((
          select jsonb_agg(jsonb_build_object('agente', r.agente, 'qual', r.fisico_qual_medicao, 'setor', s.setor_ghe))
            from public.riscos r left join public.setores s on s.id_setor = r.id_setor
           where r.id_inspecao = i.id_inspecao and r.tipo_risco = 'FÃ­sico' and r.fisico_necessita_medicao = 'Sim'), '[]'::jsonb),
        'quimicos', coalesce((
          select jsonb_agg(distinct coalesce(nullif(trim(r.agente), ''), 'Agente quÃ­mico'))
            from public.riscos r where r.id_inspecao = i.id_inspecao and r.tipo_risco = 'QuÃ­mico'), '[]'::jsonb),
        'quimicos_setores', coalesce((
          select jsonb_agg(distinct s.setor_ghe)
            from public.riscos r join public.setores s on s.id_setor = r.id_setor
           where r.id_inspecao = i.id_inspecao and r.tipo_risco = 'QuÃ­mico' and nullif(btrim(s.setor_ghe), '') is not null), '[]'::jsonb),
        'psicossociais_setores', coalesce((
          select jsonb_agg(distinct s.setor_ghe)
            from public.riscos r join public.setores s on s.id_setor = r.id_setor
           where r.id_inspecao = i.id_inspecao and r.tipo_risco = 'Psicossocial' and nullif(btrim(s.setor_ghe), '') is not null), '[]'::jsonb),
        'ergonomicos', (select count(*) from public.riscos r where r.id_inspecao = i.id_inspecao and r.tipo_risco = 'ErgonÃ´mico'),
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
        -- SÃ³ os riscos e sÃ³ o que a tela usa: o resto da foto (justificativa, nÃ­veis) Ã© da equipe.
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
    ), '[]'::jsonb),
    -- v356: atendimentos de GRUPO (ConciliaÃ§Ã£o por grupo â€º Liberar). O vendedor sÃ³ recebe o concluÃ­do com a conciliaÃ§Ã£o
    -- do grupo fechada; quem libera vÃª todos. Cada um leva as empresas do grupo, as intervenÃ§Ãµes (com as empresas que
    -- tÃªm o setor) e os riscos Confirmar/AET do Ãºltimo fechamento do grupo.
    'grupos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_grupo', t.id_grupo, 'nome_grupo', g.nome, 'status', t.status, 'parecer', t.parecer,
        'concluido_em', t.concluido_em, 'concluido_por', t.concluido_por,
        'fechada', public.comercial_conciliacao_grupo_fechada(t.id_grupo),
        'empresas', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id_empresa', e.id_empresa, 'nome_empresa', e.nome_empresa, 'cnpj', e.cnpj, 'municipio', e.municipio, 'uf', e.uf,
            'id_unidade', e.id_unidade, 'telefone', e.telefone, 'email', e.email) order by e.nome_empresa)
            from public.empresas e
           where e.id_grupo = t.id_grupo
             -- v361: só as empresas que entraram na conciliação do grupo (a foto do último fechamento); a que ficou fora
             -- (Grupos de empresas › Fontes) não é coberta pela liberação do grupo e segue com a liberação própria.
             and e.id_empresa in (
               select x ->> 'id_empresa'
                 from (select f.empresas from public.psico_conciliacao_grupo_fechamentos f
                        where f.id_grupo = t.id_grupo order by f.fechado_em desc limit 1) u,
                      jsonb_array_elements(u.empresas) x)), '[]'::jsonb),
        'intervencoes', coalesce((
          select jsonb_agg(to_jsonb(x) order by x.setor_nome, x.fator_nome)
            from public.comercial_grupo_intervencoes x where x.id_grupo = t.id_grupo), '[]'::jsonb),
        'itens', coalesce((
          select jsonb_agg(jsonb_build_object(
            'setor', it ->> 'setor', 'setor_chave', it ->> 'setor_chave', 'id_fator', it ->> 'id_fator',
            'fator', it ->> 'fator', 'questionario', it ->> 'questionario', 'decisao', it ->> 'decisao',
            'id_empresas', coalesce(it -> 'id_empresas', '[]'::jsonb)))
            from (
              select f.itens from public.psico_conciliacao_grupo_fechamentos f
               where f.id_grupo = t.id_grupo order by f.fechado_em desc limit 1
            ) u, jsonb_array_elements(u.itens) it
           where it ->> 'decisao' in ('CONFIRMAR', 'AET')
        ), '[]'::jsonb)))
        from public.comercial_atendimentos_grupo t
        join public.empresa_grupos g on g.id_grupo = t.id_grupo
       where v_libera or (t.status = 'CONCLUIDO' and public.comercial_conciliacao_grupo_fechada(t.id_grupo))
    ), '[]'::jsonb)
  );
end $function$;

notify pgrst, 'reload schema';

commit;
