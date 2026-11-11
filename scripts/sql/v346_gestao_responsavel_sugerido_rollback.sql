-- Desfaz a v346 (responsável sugerido). A janela da tarefa só deixa de mostrar as sugestões.
begin;
drop function if exists public.gestao_sugerir_responsaveis(text, text);
drop function if exists public.gestao_tarefas_parecidas(text, text);
notify pgrst, 'reload schema';
commit;
