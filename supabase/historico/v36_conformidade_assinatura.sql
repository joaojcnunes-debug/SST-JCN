-- V36 — Campos pra bloco de assinaturas no Relatório de Conformidade
--
-- `responsavel_empresa` — nome de quem assina pelo lado da empresa auditada
--                          (geralmente o gestor/responsável do setor inspecionado)
-- `cidade`              — cidade onde a inspeção foi realizada, usada na linha
--                          de fechamento "Cidade, dd de mês de YYYY"
--
-- O campo `responsavel` (já existente) continua sendo o nome do RESPONSÁVEL
-- TÉCNICO da Chabra que conduziu a auditoria.

alter table public.relatorios_conformidade
  add column if not exists responsavel_empresa text;

alter table public.relatorios_conformidade
  add column if not exists cidade text;
