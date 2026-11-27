-- Rollback da v373 (JCN 0.3.330).
begin;
-- Tira 'metodos_intervencao' da comercial_dados (desfaz a troca, sem mexer no resto) e apaga a coluna metodos do catálogo.
do $$
declare
  d text := pg_get_functiondef('public.comercial_dados()'::regprocedure);
  a int := position(E'\n    -- v373: o texto padrão do método de cada intervenção' in d);
  b int := position(E'\n    ''planos'', coalesce((' in d);
begin
  if a > 0 then
    if b < a then raise exception 'v373 rollback: não achei o trecho de ''planos'' depois do bloco'; end if;
    execute substr(d, 1, a - 1) || substr(d, b);
  end if;
end $$;
alter table public.comercial_intervencoes drop constraint if exists comercial_intervencoes_metodos_objeto;
alter table public.comercial_intervencoes drop column if exists metodos;
notify pgrst, 'reload schema';
commit;
