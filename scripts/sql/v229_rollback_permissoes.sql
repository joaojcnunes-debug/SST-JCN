-- Desfaz a v229: devolve perfil, unidades, módulos e flags de cada conta a partir
-- do backup gravado pela própria migration. Mantém a tabela funcoes_painel e a
-- coluna usuarios.funcao (vazias de efeito) — apagá-las é o bloco opcional no fim.
begin;
update public.usuarios u
   set perfil = b.perfil, unidades = b.unidades, modulos_permitidos = b.modulos_permitidos,
       pode_criar = b.pode_criar, pode_editar = b.pode_editar, pode_excluir = b.pode_excluir, funcao = b.funcao_antes, nivel = b.nivel_antes
  from public.backup_v229_usuarios_permissoes b
 where b.id_usuario = u.id_usuario;
delete from public.schema_migrations where version = 'v229_permissoes_funcoes_por_rastro';
commit;
-- Opcional, só depois de conferir:
-- alter table public.usuarios drop column if exists funcao;
-- alter table public.usuarios drop column if exists nivel;
-- drop table if exists public.funcoes_painel;
-- drop table if exists public.backup_v229_usuarios_permissoes;
notify pgrst, 'reload schema';
