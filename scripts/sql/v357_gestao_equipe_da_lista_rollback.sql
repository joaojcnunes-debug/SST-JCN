-- ROLLBACK v357 — tira a gestao_equipe_da_lista. Volte antes o código (0.3.292): sem a função o seletor de
-- Responsável cai no "todos" (a consulta falha e a tela mostra todo mundo, como antes).
begin;
drop function if exists public.gestao_equipe_da_lista(text);
notify pgrst, 'reload schema';
commit;
