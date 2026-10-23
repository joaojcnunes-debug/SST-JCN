-- v293 (JCN) — Gestão: fecha 3 RPCs da Google Agenda abertas a anon/authenticated.
-- Na portação da v209 o default privilege do Supabase deixou gestao_google_ler_token,
-- gestao_google_salvar_conta e gestao_google_status executáveis por qualquer chave pública
-- (no painel são só service_role). Só as rotas do servidor (/api/gestao/google/*) chamam.
-- Aplicada em 23/10/2026. ROLLBACK: scripts/sql/v293_gestao_google_rpcs_so_servidor_rollback.sql

revoke all on function public.gestao_google_ler_token(text, text) from public, anon, authenticated;
revoke all on function public.gestao_google_salvar_conta(text, text, text) from public, anon, authenticated;
revoke all on function public.gestao_google_status(text) from public, anon, authenticated;
grant execute on function public.gestao_google_ler_token(text, text) to service_role;
grant execute on function public.gestao_google_salvar_conta(text, text, text) to service_role;
grant execute on function public.gestao_google_status(text) to service_role;
-- Função de gatilho: não é chamável pela API, mas fecha mesmo assim.
revoke all on function public.gestao_google_enfileirar_trg() from public, anon, authenticated;
notify pgrst, 'reload schema';
