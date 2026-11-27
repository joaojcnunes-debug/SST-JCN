-- v376 — Comercial › Orçamentos, Fase 2: os modelos grupo de empresas, valor por vida, inclusão do Designado CIPA e
-- tabela de exames (27/11/2026, 0.3.340).
--
-- POR QUÊ: pedido do João — completar os modelos das bases de conhecimento (Fase 2): proposta para grupo de empresas
-- com desconto (e anexo de distribuição por empresa), precificação por vida (mínimo de vidas e tabela por função),
-- proposta de inclusão do Designado CIPA (mensalidade atual + R$ 15,00) e tabela de exames (por setor e valores
-- unitários), que também pode ir como anexo dos outros orçamentos.
--
-- O QUE MUDA: só a lista de modelos aceitos em comercial_orcamentos.modelo (constraint comercial_orcamentos_modelo_check).
-- O conteúdo de cada modelo continua em `dados` (jsonb); nenhuma coluna nova, nenhum dado alterado.
-- REAPLICAR: idempotente (drop constraint if exists + add). Rollback: scripts/sql/v376_comercial_orcamentos_fase2_rollback.sql.

begin;

alter table public.comercial_orcamentos drop constraint if exists comercial_orcamentos_modelo_check;
alter table public.comercial_orcamentos add constraint comercial_orcamentos_modelo_check
  check (modelo in ('essencial', 'grupo', 'vida', 'cipa', 'treinamentos', 'avulso', 'exames'));

notify pgrst, 'reload schema';
commit;
