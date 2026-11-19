-- ROLLBACK v364 — tira o tempo de campo (tabela, funções e gatilho). APAGA as sessões de campo gravadas.
-- Volte antes o código (0.3.314), que chama essas funções.
begin;

drop trigger if exists trg_campo_sessoes_fechar_por_status on public.inspecoes;
drop function if exists public.campo_sessoes_fechar_por_status_trg();
drop function if exists public.campo_sessao_atividade(text);
drop function if exists public.campo_sessao_pausar(text, text);
drop function if exists public.campo_sessao_iniciar(text, text);
drop function if exists public.campo_sessao_pode(text, text, text, text);
drop function if exists public.campo_sessoes_fechar_inativas();
drop table if exists public.campo_sessoes;

notify pgrst, 'reload schema';
commit;
