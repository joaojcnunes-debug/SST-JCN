-- Rollback da v241 (SGG-RISCOS-01 fase 1). Inverso exato; migrate.ps1 ignora (nome tem "rollback").
-- Perde-se o conteúdo de sgg_envios (vazio na fase 1) e o de empresas.sgg_* (vazio na fase 1).
-- auditoria_eventos é append-only: linhas com tabela='sgg_envios' ficam (histórico, não estado).
\set ON_ERROR_STOP on
begin;

do $$ begin
  if to_regclass('public.sgg_envios') is not null
     and exists (select 1 from pg_proc where proname = 'auditoria_desativar') then
    perform public.auditoria_desativar('sgg_envios');
  end if;
end $$;
delete from public.auditoria_tabelas where tabela = 'sgg_envios';

drop table if exists public.sgg_envios;

drop function if exists public.pode_enviar_sgg();

alter table public.usuarios drop column if exists pode_enviar_sgg;
alter table public.usuarios drop column if exists pode_enviar_sgg_concedido_por;
alter table public.usuarios drop column if exists pode_enviar_sgg_concedido_em;

drop index if exists public.ux_empresas_sgg;
alter table public.empresas drop constraint if exists empresas_sgg_base_sgg_chk;
alter table public.empresas drop constraint if exists empresas_sgg_par_chk;
alter table public.empresas drop column if exists sgg_base_sgg;
alter table public.empresas drop column if exists sgg_id;
alter table public.empresas drop column if exists sgg_resolvido_em;
alter table public.empresas drop column if exists sgg_resolvido_por;

delete from public.schema_migrations where version = 'v241_sgg_riscos_fase1';

commit;
