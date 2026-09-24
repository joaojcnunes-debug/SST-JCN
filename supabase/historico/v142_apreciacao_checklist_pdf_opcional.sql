-- V142 — Impressão do checklist NR-12 no PDF vira opção POR LAUDO.
-- Antes era uma constante global no template (INCLUIR_CHECKLIST_PDF=false).
-- Aditiva/idempotente; default false = mantém o comportamento atual.
-- Já aplicada via MCP.
alter table public.apreciacoes_maquinas
  add column if not exists incluir_checklist_pdf boolean not null default false;
