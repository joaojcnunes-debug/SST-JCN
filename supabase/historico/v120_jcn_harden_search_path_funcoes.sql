-- v120 (JCN) — Hardening: fixa search_path=public nas funções apontadas pelo advisor como
-- mutáveis (function_search_path_mutable). Aplicado via MCP. Usa ALTER (aditivo, não reescreve corpo).
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'salvar_aet13fatores_perguntas','update_aep_relatorios_updated_at',
        'prod_set_atualizado_em','gestao_email','gestao_nivel_ord'
      )
  loop
    execute 'alter function ' || r.sig::text || ' set search_path = public';
  end loop;
end $$;
