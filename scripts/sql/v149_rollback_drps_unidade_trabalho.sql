-- Rollback da v149 (JCN) — remove drps_respondentes.unidade_trabalho.
-- Descarta as unidades já capturadas; elas voltam na próxima reimportação do
-- Forms, já que o dado de origem é a planilha. A v150 depende desta coluna:
-- desfaça a v150 primeiro.

drop index if exists public.idx_drps_resp_unidade;

alter table public.drps_respondentes
  drop column if exists unidade_trabalho;
