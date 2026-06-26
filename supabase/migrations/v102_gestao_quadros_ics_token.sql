-- Fase 12c — Calendário externo: token para o feed ICS por lista.
-- Gerado sob demanda; a Edge Function pública gestao-ics valida o token e
-- devolve as tarefas com prazo como eventos (text/calendar). Regenerar o token revoga o link antigo.
alter table public.gestao_quadros add column if not exists ics_token text unique;
