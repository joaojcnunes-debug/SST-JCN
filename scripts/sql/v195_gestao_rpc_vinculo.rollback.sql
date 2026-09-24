-- ROLLBACK de v195_gestao_rpc_vinculo.sql — GESTAO-KANBAN-01-F1.3-C.
--
-- Desfaz o RPC logado de vinculo: dropa gestao_vincular/gestao_desvincular e a tabela
-- de log dedicada gestao_vinculo_log, e remove a linha de schema_migrations.
--
-- PRE-REQUISITO: aplicar o rollback da v196 (re-grant do DML direto) ANTES deste, senao
-- a Gestao fica sem NENHUM caminho de escrita de vinculo (nem RPC, nem DML). Ordem:
-- reverter front -> aplicar rollback v196 -> aplicar este rollback v195.
--
-- migrate.ps1 pula arquivos com "rollback" no nome: este NUNCA e aplicado no forward.
-- Rodar manual: psql -U chabra_admin -d painel_sst -f v195_gestao_rpc_vinculo.rollback.sql

begin;

drop function if exists public.gestao_vincular(text,text,text);
drop function if exists public.gestao_desvincular(text,text,text);

drop policy if exists gestao_vinculo_log_sel on public.gestao_vinculo_log;
drop table if exists public.gestao_vinculo_log;

delete from public.schema_migrations where version = 'v195_gestao_rpc_vinculo';

commit;
