-- Desfaz a v232: apaga o log de leitura e a RPC.
begin;
drop function if exists public.modulo_abrir(text);
drop table if exists public.modulo_aberturas;
delete from public.schema_migrations where version = 'v232_modulo_aberturas_log_leitura';
commit;
notify pgrst, 'reload schema';
