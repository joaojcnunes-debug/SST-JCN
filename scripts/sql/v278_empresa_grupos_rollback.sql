-- Rollback da v278 (JCN; v282 no painel): tira os grupos de empresas (as empresas em si não mudam).
BEGIN;
drop function if exists public.empresa_grupo_excluir(text);
drop function if exists public.empresa_grupo_definir_matriz(text, text);
drop function if exists public.empresa_grupos_membros();
drop index if exists public.ux_empresas_matriz_por_grupo;
drop index if exists public.ix_empresas_id_grupo;
alter table public.empresas drop constraint if exists empresas_grupo_papel_juntos_chk;
alter table public.empresas drop constraint if exists empresas_papel_grupo_chk;
alter table public.empresas drop constraint if exists empresas_id_grupo_fkey;
alter table public.empresas drop column if exists papel_grupo;
alter table public.empresas drop column if exists id_grupo;
drop table if exists public.empresa_grupos;
NOTIFY pgrst, 'reload schema';
COMMIT;
