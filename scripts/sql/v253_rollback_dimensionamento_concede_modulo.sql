-- ROLLBACK da v253 — tira o módulo `dimensionamento` de quem a v253 concedeu.
--
-- Devolve o estado EXATO de antes, lido de `backup_v253_modulos` — não tenta adivinhar
-- quem já tinha o módulo por outro caminho. Contas criadas depois da v253 (que nasceram
-- com o módulo pela `funcoes_painel`) não estão no backup: para essas, o array_remove
-- no fim cobre.
--
-- Efeito: o módulo volta a ser inalcançável pela tela. As 12 tabelas, os dados e a RLS
-- continuam de pé — isto aqui é só permissão de navegação.

begin;

do $$ begin
  if current_user <> 'chabra_admin' then raise exception 'aplicar como chabra_admin'; end if;
end $$;

-- 1) quem estava no backup volta ao array exato de antes
update public.usuarios u
   set modulos_permitidos = b.modulos_permitidos
  from public.backup_v253_modulos b
 where b.id_usuario = u.id_usuario;

-- 2) quem não estava no backup (conta criada depois) perde só o módulo desta frente
update public.usuarios u
   set modulos_permitidos = array_remove(u.modulos_permitidos, 'dimensionamento')
 where u.modulos_permitidos @> array['dimensionamento']::text[]
   and not exists (select 1 from public.backup_v253_modulos b where b.id_usuario = u.id_usuario);

update public.funcoes_painel f
   set modulos_padrao = array_remove(f.modulos_padrao, 'dimensionamento')
 where f.modulos_padrao @> array['dimensionamento']::text[];

drop table if exists public.backup_v253_modulos;
delete from public.schema_migrations where version = 'v253_dimensionamento_concede_modulo';

commit;
