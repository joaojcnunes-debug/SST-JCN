-- Rollback da v242 (memo por transação das funções de unidade/Admin).
-- Devolve caller_eh_admin() e caller_unidades() EXATAMENTE como estavam
-- antes (SQL, STABLE, SECURITY DEFINER) e derruba o memo.
-- caller_pode_ver_empresa não foi tocada pela v242.

begin;

CREATE OR REPLACE FUNCTION public.caller_eh_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.usuarios
     WHERE lower(email) = lower(auth.jwt() ->> 'email')
       AND perfil = 'Admin'
       AND ativo_sistema = TRUE
  );
$function$
;

CREATE OR REPLACE FUNCTION public.caller_unidades()
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(u.unidades, '{}')
    from public.usuarios u
   where lower(u.email) = lower(auth.jwt() ->> 'email')
     and u.ativo_sistema = true
   limit 1;
$function$
;

comment on function public.caller_eh_admin() is null;
comment on function public.caller_unidades() is null;

drop function if exists public.caller_memo();

delete from public.schema_migrations where version = 'v242_rls_memo_por_transacao';

commit;

notify pgrst, 'reload schema';
