-- v337 — pdfs_assinados.tipo_assinatura (10/11/2026, 0.3.259).
--
-- O código (assinatura por imagem em /api/sign-image, o relatório, a folha de assinatura do técnico e
-- usePdfsGerados) lê e grava pdfs_assinados.tipo_assinatura, mas a coluna não existia no banco do JCN:
-- abrir o relatório dava erro 400 na leitura e assinar com a imagem falhava ao gravar (a tabela estava
-- vazia em 10/11). No Painel SST a coluna existe desde a criação da tabela.
--   NULL       = assinatura com certificado digital (/api/sign-pdf não grava o tipo)
--   'imagem'   = assinatura com a imagem do técnico (/api/sign-image)
--
-- Rollback: scripts/sql/v337_pdfs_assinados_tipo_assinatura_rollback.sql
begin;

alter table public.pdfs_assinados add column if not exists tipo_assinatura text;
alter table public.pdfs_assinados drop constraint if exists pdfs_assinados_tipo_assinatura_valido;
alter table public.pdfs_assinados
  add constraint pdfs_assinados_tipo_assinatura_valido
  check (tipo_assinatura is null or tipo_assinatura in ('imagem', 'certificado'));
comment on column public.pdfs_assinados.tipo_assinatura is
  'v337: NULL = certificado digital; ''imagem'' = assinatura com a imagem do técnico.';

notify pgrst, 'reload schema';

commit;
