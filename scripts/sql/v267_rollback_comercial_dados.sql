-- Rollback da v267: tira a função e o módulo 'comercial' das contas.
drop function if exists public.comercial_dados();
update public.usuarios set modulos_permitidos = array_remove(modulos_permitidos, 'comercial')
 where 'comercial' = any(modulos_permitidos);
