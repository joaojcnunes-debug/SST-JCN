-- v275 (2026-10-06): REMOVE a Fase 3 (questionário anônimo por QR Code),
-- a pedido do usuário — ficam só as Fases 1 e 2 da AEP. Desfaz a v273
-- (tipo QPS "Triagem anônima AEP", qps_coletas_anonimas,
-- qps_respostas_anonimas, funções de resultado/comentários) e a v274
-- (qps_questionario_publico, qps_responder_anonimo). Não havia dados reais
-- (0 links, 0 respostas, 0 aplicações). O módulo QPS volta ao que era.
-- Já aplicada via MCP. Sem rollback (as v273/v274 saíram do código no revert).
drop function if exists public.qps_responder_anonimo(text, jsonb, text);
drop function if exists public.qps_questionario_publico(text);
drop function if exists public.qps_comentarios_coleta(text);
drop function if exists public.qps_resultado_coleta(text);
drop table if exists public.qps_respostas_anonimas;
drop table if exists public.qps_coletas_anonimas;
delete from public.qps_tipos t where t.id_tipo = 'a3e70000-0000-4000-8000-000000000000'
  and not exists (select 1 from public.qps_aplicacoes a where a.id_tipo = t.id_tipo);
