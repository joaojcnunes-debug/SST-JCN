-- Rollback da v336 — sai o gatilho das preferências de aviso, as RPCs e a tabela. Todos voltam a receber
-- os avisos no sino e por e-mail, como antes. Volte antes o código para a 0.3.256.
begin;

drop trigger if exists gestao_notificacao_preferencia_trg on public.gestao_notificacoes;
drop function if exists public.gestao_notificacao_preferencia_trg();
drop function if exists public.gestao_salvar_preferencias_aviso(boolean, boolean);
drop function if exists public.gestao_minhas_preferencias_aviso();
drop table if exists public.gestao_aviso_preferencias;

notify pgrst, 'reload schema';

commit;
