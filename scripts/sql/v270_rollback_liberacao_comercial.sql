-- Rollback da v270: reaplicar antes a função da v269
-- (supabase/historico/v269_comercial_dados_datas.sql), depois:
drop trigger if exists trg_inspecoes_retira_comercial on public.inspecoes;
drop trigger if exists trg_aep_retira_comercial on public.aep_relatorios;
drop function if exists public.fn_retira_do_comercial();
alter table public.inspecoes drop column if exists liberado_comercial_em, drop column if exists liberado_comercial_por;
alter table public.aep_relatorios drop column if exists liberado_comercial_em, drop column if exists liberado_comercial_por;
