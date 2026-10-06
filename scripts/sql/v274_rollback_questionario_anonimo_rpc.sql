-- Rollback da v274: remove as portas públicas do questionário anônimo.
-- (A rota /api/publico/questionario deixa de funcionar.)
drop function if exists public.qps_responder_anonimo(text, jsonb, text);
drop function if exists public.qps_questionario_publico(text);
