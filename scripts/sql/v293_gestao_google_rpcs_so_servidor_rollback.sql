-- ROLLBACK da v293 (JCN): devolve EXECUTE a anon/authenticated (estado inseguro anterior).
-- Só use se alguma tela chamar essas RPCs direto do navegador — hoje nenhuma chama.
grant execute on function public.gestao_google_ler_token(text, text) to anon, authenticated;
grant execute on function public.gestao_google_salvar_conta(text, text, text) to anon, authenticated;
grant execute on function public.gestao_google_status(text) to anon, authenticated;
grant execute on function public.gestao_google_enfileirar_trg() to anon, authenticated;
notify pgrst, 'reload schema';
