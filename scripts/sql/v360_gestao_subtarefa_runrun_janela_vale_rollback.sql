-- ROLLBACK v360 — tira a trava: a sincronização do Runrun volta a poder regravar o responsável da linha (e, pelo
-- gatilho da janela, os responsáveis dela).
begin;
drop trigger if exists gestao_subtarefa_resp_janela_vale on public.gestao_subtarefas;
drop function if exists public.gestao_subtarefa_resp_janela_vale_trg();
notify pgrst, 'reload schema';
commit;
