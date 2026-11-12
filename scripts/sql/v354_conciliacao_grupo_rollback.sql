-- ROLLBACK v354 — tira a Conciliação por grupo do banco.
-- ATENÇÃO: apaga os pareceres, as ligações, os fechamentos e as reaberturas DOS GRUPOS. As ações 5W2H criadas
-- pelos pareceres do grupo ficam no Plano de Ação de cada empresa. Volte antes o código para a 0.3.284.
begin;
-- Os gatilhos de só inserção barram o DROP? Não: DROP TABLE não dispara gatilho de linha.
drop table if exists public.psico_conciliacao_grupo_reaberturas;
drop table if exists public.psico_conciliacao_grupo_fechamentos;
drop table if exists public.psico_conciliacao_grupo_pareceres;
drop table if exists public.psico_conciliacao_grupo_setor_depara;
drop function if exists public.psico_conc_grupo_reabertura_valida();
drop function if exists public.psico_caller_ve_grupo(text);
notify pgrst, 'reload schema';
commit;
