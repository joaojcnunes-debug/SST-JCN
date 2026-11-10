-- Rollback da v334 — apaga usuarios.ve_relatorio_lista. Volte ANTES o código para a 0.3.254
-- (o useAuth da 0.3.255 lê a coluna).
begin;

alter table public.usuarios drop column if exists ve_relatorio_lista;

notify pgrst, 'reload schema';

commit;
