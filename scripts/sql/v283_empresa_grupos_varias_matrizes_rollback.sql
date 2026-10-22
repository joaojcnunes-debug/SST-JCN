-- ROLLBACK da v283: volta "no máximo 1 matriz por grupo".
-- Antes de recriar o índice, rebaixa a FILIAL as matrizes excedentes (fica a mais antiga por id).
begin;
update public.empresas e set papel_grupo = 'FILIAL'
 where papel_grupo = 'MATRIZ'
   and exists (select 1 from public.empresas o
                where o.id_grupo = e.id_grupo and o.papel_grupo = 'MATRIZ' and o.id_empresa < e.id_empresa);
create unique index if not exists ux_empresas_matriz_por_grupo on public.empresas (id_grupo) where papel_grupo = 'MATRIZ';
create or replace function public.empresa_grupo_definir_matriz(p_id_grupo text, p_id_empresa text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.caller_pode_editar() then raise exception 'sem permissão para editar grupos' using errcode = '42501'; end if;
  if not public.caller_pode_ver_empresa(p_id_empresa) then raise exception 'a empresa é de outra unidade' using errcode = '42501'; end if;
  if not exists (select 1 from public.empresas where id_empresa = p_id_empresa and id_grupo = p_id_grupo) then
    raise exception 'a empresa não está neste grupo';
  end if;
  update public.empresas set papel_grupo = 'FILIAL' where id_grupo = p_id_grupo and papel_grupo = 'MATRIZ' and id_empresa <> p_id_empresa;
  update public.empresas set papel_grupo = 'MATRIZ' where id_empresa = p_id_empresa;
end $$;
commit;
notify pgrst, 'reload schema';
