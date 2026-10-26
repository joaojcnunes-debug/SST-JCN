-- ROLLBACK da v296 (JCN): volta a dashboard_reaberturas da v295 (reaplique o bloco 5 de
-- supabase/historico/v295_dashboard_primeira_conclusao.sql) e tira o índice.
drop index if exists public.auditoria_eventos_tab_reg_id_idx;
