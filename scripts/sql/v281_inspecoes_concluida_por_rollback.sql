-- ROLLBACK da v281
begin;
drop trigger if exists inspecoes_concluida_por on public.inspecoes;
drop function if exists public.inspecoes_carimba_concluida_por();
alter table public.inspecoes drop column if exists concluida_por_email;
commit;
notify pgrst, 'reload schema';
