-- v267 (2026-10-05): módulo Comercial. Uma função só de leitura entrega ao
-- comercial o que ele precisa (AEPs entregues ao cliente + situação de
-- AET/DRPS/QPS por empresa) sem dar acesso aos módulos AEP/AET/DRPS
-- (rls_modulo). Quem chama precisa ser Admin ou ter 'comercial' em
-- modulos_permitidos. Liga o módulo para os Admins ativos.
-- Já aplicada via MCP. Rollback: scripts/sql/v267_rollback_comercial_dados.sql
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
        'empresas', jsonb_build_object(
          'nome_empresa', e.nome_empresa, 'cnpj', e.cnpj, 'municipio', e.municipio, 'uf', e.uf,
          'id_unidade', e.id_unidade, 'telefone', e.telefone, 'email', e.email)))
        from public.aep_relatorios a
        join public.empresas e on e.id_empresa = a.id_empresa
        left join public.inspecoes i on i.id_inspecao = a.id_inspecao
       where (a.id_inspecao is not null and i.elaboracao_status = 'CONCLUIDO' and i.status <> 'DELETADA')
          or (a.id_inspecao is null and a.status = 'CONCLUIDO')
    ), '[]'::jsonb),
    'docs', coalesce((
      select jsonb_agg(jsonb_build_object('id_empresa', d.id_empresa, 'tipo', d.tipo, 'status', d.status))
        from (
          select id_empresa, 'DRPS'::text as tipo, status from public.drps_relatorios
          union all select id_empresa, 'QPS', status from public.qps_aplicacoes
          union all select id_empresa, 'AET', status from public.aet_relatorios
        ) d
       where d.id_empresa in (select id_empresa from public.aep_relatorios)
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.comercial_dados() from public, anon;
grant execute on function public.comercial_dados() to authenticated;

update public.usuarios
   set modulos_permitidos = array_append(modulos_permitidos, 'comercial')
 where perfil = 'Admin' and ativo_sistema = true
   and modulos_permitidos is not null
   and not ('comercial' = any(modulos_permitidos));
