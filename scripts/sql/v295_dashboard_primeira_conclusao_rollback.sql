-- ROLLBACK da v295 (JCN). O dashboard volta a contar por concluida_em / elaboracao_concluida_em
-- (o código anterior não lê as colunas novas). Rodar DEPOIS de voltar o código.
drop function if exists public.dashboard_assuncoes();
drop function if exists public.dashboard_reaberturas(text);
drop function if exists public.dashboard_caller_interno();
drop trigger if exists inspecoes_primeira_conclusao on public.inspecoes;
drop function if exists public.inspecoes_primeira_conclusao_trg();
alter table public.inspecoes
  drop column if exists primeira_conclusao_em,
  drop column if exists primeira_conclusao_por,
  drop column if exists primeira_elaboracao_em,
  drop column if exists primeira_elaboracao_por;
notify pgrst, 'reload schema';
