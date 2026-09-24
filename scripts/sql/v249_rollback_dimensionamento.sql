-- ROLLBACK da v249 (DIM-01) — desfaz o schema `dim_*` inteiro.
--
-- Seguro de rodar enquanto a v244 (retirada do Produtividade) NÃO tiver sido aplicada:
-- a v249 é aditiva, então desfazê-la devolve a base ao estado anterior sem tocar em
-- `prod_*`, em `usuarios.modulos_permitidos` nem em nada do painel.
--
-- ⚠️ APAGA OS DADOS do dimensionamento. Se a carga da Fase 1.2 já rodou, tire um
-- `pg_dump -t 'public.dim_*'` ANTES — a origem no Supabase do João continua de pé até
-- o cutover, mas o que tiver sido editado dentro do painel só existe aqui.
--
-- Aplicar como chabra_admin:
--   psql -v ON_ERROR_STOP=1 -f v249_rollback_dimensionamento.sql

begin;

do $$ begin
  if current_user <> 'chabra_admin' then
    raise exception 'aplicar como chabra_admin';
  end if;
end $$;

-- Ordem: dependentes primeiro (FK). `cascade` cobre policies e gatilhos.
drop table if exists public.dim_historico            cascade;
drop table if exists public.dim_sincronizacao_sst    cascade;
drop table if exists public.dim_unidade_mes          cascade;
drop table if exists public.dim_demanda_mensal       cascade;
drop table if exists public.dim_colaborador_unidades cascade;
drop table if exists public.dim_colaboradores        cascade;
drop table if exists public.dim_clientes_porte       cascade;
drop table if exists public.dim_portes               cascade;
drop table if exists public.dim_documentos           cascade;
drop table if exists public.dim_parametros           cascade;
drop table if exists public.dim_funcoes              cascade;
drop table if exists public.dim_unidades             cascade;

-- RPCs de escrita.
drop function if exists public.dim_definir_alocacoes(uuid, jsonb)                 cascade;
drop function if exists public.dim_substituir_demanda_ano(integer, jsonb, text)   cascade;
drop function if exists public.dim_aplicar_sincronizacao_sst(jsonb)               cascade;

-- Funções de gatilho só depois das tabelas (os gatilhos dependem delas).
drop function if exists public.dim_registrar_historico()    cascade;
drop function if exists public.dim_checar_soma_alocacoes()  cascade;
drop function if exists public.dim_set_updated_at()         cascade;

delete from public.rls_modulo_tabelas where modulo = 'dimensionamento';
delete from public.schema_migrations  where version = 'v249_dimensionamento';

commit;

notify pgrst, 'reload schema';
