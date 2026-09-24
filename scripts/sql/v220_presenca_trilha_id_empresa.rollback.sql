-- Rollback de v220_presenca_trilha_id_empresa.sql — devolve presenca_trilha() à forma da v219
-- (sem id_empresa no JSON). Reaplicar a função da v219 é o caminho: rode o trecho
-- "2) Trilha da auditoria" de supabase/migrations/v219_presenca_relatorio_trilha_encerrar.sql.
-- O front da v0.3.609 tolera a chave ausente (mostra o código do registro).
-- Nome com "rollback" → migrate.ps1 NÃO aplica isto no fluxo normal (é manual, gateado).

delete from schema_migrations where version like 'v220_presenca%';
