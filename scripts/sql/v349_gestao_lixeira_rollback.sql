-- Desfaz a v349 (Gestão: Lixeira): a exclusão volta a ser definitiva como antes.
-- A TABELA gestao_lixeira e o que está nela FICAM (nada se perde; dá para religar reaplicando as funções da v349).
-- Para apagar também o conteúdo da lixeira, depois de conferir: drop table public.gestao_lixeira;
begin;
select cron.unschedule('gestao-lixeira-limpar') where exists (select 1 from cron.job where jobname = 'gestao-lixeira-limpar');
drop trigger if exists zz_gestao_lixeira on public.gestao_tarefas;
drop trigger if exists zz_gestao_lixeira on public.gestao_quadros;
drop function if exists public.gestao_lixeira_listar();
drop function if exists public.gestao_lixeira_restaurar(uuid);
drop function if exists public.gestao_lixeira_limpar();
drop function if exists public.gestao_lixeira_devolver_tarefas(jsonb);
drop function if exists public.gestao_lixeira_inserir(text, jsonb);
drop function if exists public.gestao_lixeira_gatilhos(boolean);
drop function if exists public.gestao_lixeira_sem_ref(jsonb, text, text, text);
drop function if exists public.gestao_lixeira_com_ref(jsonb, text, text, text);
drop function if exists public.gestao_lixeira_ve(text, boolean, text[]);
drop function if exists public.gestao_lixeira_quadro_trg();
drop function if exists public.gestao_lixeira_tarefa_trg();
drop function if exists public.gestao_lixeira_retrato_tarefas(text[]);
drop function if exists public.gestao_lixeira_linhas(text, text, text[], text);
drop function if exists public.gestao_lixeira_email();
notify pgrst, 'reload schema';
commit;
