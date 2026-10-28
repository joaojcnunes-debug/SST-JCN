-- Rollback da v306 (prioridade, prazo, espera e "Minhas inspeções"). Rodar DEPOIS de voltar o código.
-- ATENÇÃO: apaga as prioridades e prazos que os supervisores marcaram. Guarde antes, se precisar:
--   select id_inspecao, prioridade, prazo, prioridade_definida_por, prioridade_definida_em
--     from public.inspecoes where prioridade is not null or prazo is not null;

drop function if exists public.inspecoes_atribuidas(text, text);
drop function if exists public.prioridade_ord(inspecoes);
drop function if exists public.prioridade_efetiva(inspecoes);
drop function if exists public.prioridade_peso(text);
drop function if exists public.prioridade_auto(inspecoes);
drop function if exists public.dias_espera(inspecoes);
drop function if exists public.espera_desde(inspecoes);
drop function if exists public.situacao_documento(inspecoes);
drop trigger if exists trg_inspecoes_prioridade on public.inspecoes;
drop function if exists public.inspecoes_prioridade_trg();
alter table public.inspecoes drop constraint if exists inspecoes_prioridade_check;
alter table public.inspecoes drop column if exists prioridade_definida_em;
alter table public.inspecoes drop column if exists prioridade_definida_por;
alter table public.inspecoes drop column if exists prazo;
alter table public.inspecoes drop column if exists prioridade;
notify pgrst, 'reload schema';
