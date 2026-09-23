-- ROLLBACK da v167 — desfaz devolução e histórico de status.
--
-- ATENÇÃO: derruba o trigger que obriga motivo na mudança de status. Depois
-- deste script, `update equipamentos set status = ...` volta a passar direto
-- pelo PostgREST, sem motivo e sem rastro. Se a intenção era só corrigir a RPC,
-- corrija a função — não rode isto.
--
-- Exporte o histórico antes, se já houver movimento real:
--   \copy (select * from public.equipamentos_status_historico) to 'status.csv' csv header
--   \copy (select * from public.equipamentos_devolucoes)       to 'devolucoes.csv' csv header
--   \copy (select * from public.equipamentos_devolucao_assinaturas) to 'assin_dev.csv' csv header
--
-- Rodar à mão:  psql -1 -v ON_ERROR_STOP=1 -f v167_equipamentos_devolucao_status_rollback.sql

drop function if exists public.equipamento_registrar_devolucao(text, text, text, date, text, text, jsonb);
-- Assinaturas primeiro: FK para equipamentos_devolucoes.
drop table    if exists public.equipamentos_devolucao_assinaturas;
drop table    if exists public.equipamentos_devolucoes_itens;
drop table    if exists public.equipamentos_devolucoes;

drop trigger  if exists trg_equipamentos_status_guard on public.equipamentos;
drop function if exists public.equipamentos_status_guard();
drop function if exists public.equipamento_mudar_status(text, text, text, text, text);
drop table    if exists public.equipamentos_status_historico;

-- `devolvido_em` NÃO é apagada aqui: a coluna nasce na v166, junto da tabela de
-- itens. Só limpa as marcações feitas pelas devoluções que este rollback desfaz.
update public.equipamentos_entregas_itens set devolvido_em = null where devolvido_em is not null;

delete from public.schema_migrations where version = 'v167_equipamentos_devolucao_status';
