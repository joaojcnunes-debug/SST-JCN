-- ROLLBACK da v282
begin;
drop function if exists public.tecnicos_busca(public.inspecoes);
drop function if exists public.tecnicos_campo(public.inspecoes);
commit;
notify pgrst, 'reload schema';
