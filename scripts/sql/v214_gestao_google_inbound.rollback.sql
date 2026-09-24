-- Rollback de v214_gestao_google_inbound.sql — F3.B (Google Agenda inbound).
-- Só RPCs foram criadas; drop das 4 desfaz tudo. As colunas sync_token/channel_* (da v209) FICAM —
-- são inertes sem as rotas. Nome com "rollback" → migrate.ps1 NÃO aplica isto no fluxo normal (manual).

drop function if exists public.gestao_google_aplicar_inbound(text, date, date, text, text);
drop function if exists public.gestao_google_excluir_inbound(text, text);
drop function if exists public.gestao_google_salvar_sync_token(text, text);
drop function if exists public.gestao_google_registrar_watch(text, text, text, timestamptz);

delete from schema_migrations where version like 'v214%';
