-- Rollback da v263: Dimensionamento volta a ser só do Admin (policy dim_admin).
begin;
do $$
declare t text;
begin
  foreach t in array array[
    'dim_unidades','dim_funcoes','dim_colaboradores','dim_colaborador_unidades',
    'dim_demanda_mensal','dim_unidade_mes','dim_clientes_porte','dim_portes',
    'dim_parametros','dim_documentos','dim_sincronizacao_sst'
  ] loop
    execute format('drop policy if exists dim_ler on public.%I', t);
    execute format('drop policy if exists dim_gravar on public.%I', t);
    execute format('create policy dim_admin on public.%I for all to authenticated using (coalesce(public.caller_eh_admin(), false)) with check (coalesce(public.caller_eh_admin(), false))', t);
  end loop;
end $$;
drop policy if exists dim_ler on public.dim_historico;
create policy dim_admin on public.dim_historico for select to authenticated using (coalesce(public.caller_eh_admin(), false));
do $$
declare f text; def text;
begin
  foreach f in array array['dim_definir_alocacoes','dim_substituir_demanda_ano'] loop
    select pg_get_functiondef(p.oid) into def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = f;
    def := replace(def, 'coalesce(public.dim_pode_editar(), false)', 'coalesce(public.caller_eh_admin(), false)');
    def := replace(def, 'Sem permissão para alterar o dimensionamento.', 'Só administradores alteram o dimensionamento.');
    execute def;
  end loop;
end $$;
drop function if exists public.dim_pode_editar();
drop function if exists public.dim_pode_ver();
drop function if exists public.dim_papel();
commit;
