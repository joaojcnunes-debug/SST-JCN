-- Rollback da v228: remove a policy de DELETE do próprio destinatário em
-- gestao_notificacoes (volta ao estado v94: só select/update/insert).
-- O grant de tabela NÃO é revogado aqui — sem policy a RLS já nega o DELETE,
-- e revogar poderia colidir com os default privileges da produção.
-- NÃO remove entrada de schema_migrations (mesma convenção do rollback_v227).

begin;

drop policy if exists notif_del on public.gestao_notificacoes;

commit;
