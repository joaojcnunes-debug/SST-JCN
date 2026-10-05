-- Rollback da v265.
drop trigger if exists trg_aep_relatorios_concluido_em on public.aep_relatorios;
drop function if exists public.aep_relatorios_concluido_em();
alter table public.aep_relatorios drop column if exists concluido_em;
