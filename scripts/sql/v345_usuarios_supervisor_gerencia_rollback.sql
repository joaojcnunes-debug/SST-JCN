-- Desfaz a v345: Sistema › Usuários volta a ser só do Admin no banco (a política "admin write usuarios" não muda).
begin;
drop trigger if exists usuarios_trava_supervisor on public.usuarios;
drop function if exists public.usuarios_trava_supervisor();
drop policy if exists "supervisor update usuarios" on public.usuarios;
drop function if exists public.usuario_conta_protegida(text, text);
drop function if exists public.caller_gere_usuarios();
notify pgrst, 'reload schema';
commit;
