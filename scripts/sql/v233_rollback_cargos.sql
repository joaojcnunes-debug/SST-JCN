-- Desfaz a v233: devolve o cargo de antes de cada conta e tira o gatilho e a lista.
begin;
drop trigger if exists usuarios_cargo_na_lista on public.usuarios;
drop function if exists public.usuarios_cargo_na_lista();
update public.usuarios u set cargo = b.cargo from public.backup_v233_usuarios_cargo b where b.id_usuario = u.id_usuario;
drop table if exists public.cargos_painel;
delete from public.schema_migrations where version = 'v233_cargos_canonicos';
commit;
-- Opcional, só depois de conferir: drop table if exists public.backup_v233_usuarios_cargo;
notify pgrst, 'reload schema';
