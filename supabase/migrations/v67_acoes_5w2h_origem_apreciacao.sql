-- ============================================================================
-- V67: "Enviar para Plano de Ação" — origem da ação na Apreciação NR-12
--
-- Ações do plano de adequação da apreciação (apreciacao_acoes) podem ser
-- enviadas pro Plano de Ação central (acoes_5w2h). A coluna marca a ação
-- de origem e o índice único parcial garante que cada ação da apreciação
-- só pode ser enviada UMA vez (dedupe no banco, não só no client).
--
-- Complementa a v49, que criou id_apreciacao_item (item do checklist) mas
-- nunca foi populada por nenhum fluxo.
-- ============================================================================

alter table public.acoes_5w2h
  add column if not exists id_apreciacao_acao text null;

create unique index if not exists idx_acoes_5w2h_origem_apreciacao
  on public.acoes_5w2h (id_apreciacao_acao)
  where id_apreciacao_acao is not null;
