-- Rollback da v333 — apaga usuarios.permissoes_modulos e usuarios.telas_bloqueadas.
-- Volte ANTES o código para a versão anterior (o useAuth da 0.3.253 lê as duas colunas).
-- As contas voltam às chaves gerais pode_criar/pode_editar/pode_excluir (que o cadastro novo continuou gravando).
begin;

alter table public.usuarios drop constraint if exists usuarios_permissoes_modulos_objeto;
alter table public.usuarios drop column if exists permissoes_modulos;
alter table public.usuarios drop column if exists telas_bloqueadas;

notify pgrst, 'reload schema';

commit;
