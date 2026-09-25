-- Rollback da v258 — apaga a tabela de certificados de treinamento.
-- ⚠️ Apaga também os certificados cadastrados. Exporte antes se houver dados.
begin;
drop table if exists public.certificados_treinamento;
drop function if exists public.certificados_treinamento_touch();
commit;
