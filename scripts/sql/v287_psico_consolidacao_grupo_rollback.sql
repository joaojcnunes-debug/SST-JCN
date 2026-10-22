-- Rollback da v287 (painel v295): tira a Consolidação Psicossocial de Grupo.
-- ⚠️ Apaga as execuções e validações registradas (são append-only — não há outro jeito
-- de removê-las). Os grupos (v282) e as empresas não mudam, fora as 2 colunas novas.
BEGIN;
drop table if exists public.psico_consolidacao_validacoes;
drop table if exists public.psico_consolidacao_itens;
drop table if exists public.psico_consolidacao_execucoes;
drop table if exists public.psico_setor_depara;
drop table if exists public.psico_setor_canonico;
drop table if exists public.psico_fator_depara;
drop table if exists public.psico_fatores;
drop table if exists public.psico_glossario;
drop function if exists public.psico_somente_insercao();
drop function if exists public.psico_caller_interno();
alter table public.empresa_grupos drop column if exists psico_fatores_ignorados;
alter table public.empresas drop constraint if exists empresas_papel_economico_chk;
alter table public.empresas drop column if exists papel_economico;
NOTIFY pgrst, 'reload schema';
COMMIT;
