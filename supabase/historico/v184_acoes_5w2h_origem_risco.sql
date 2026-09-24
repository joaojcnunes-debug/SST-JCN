-- ============================================================================
-- V184: "Enviar para Plano de Ação" — origem da ação no RISCO da inspeção
--
-- A inspeção era o único módulo grande sem porta para o Plano de Ação central
-- (acoes_5w2h). As colunas id_inspecao / id_setor / id_risco já existiam e
-- estavam vazias em 100% das linhas — o vínculo foi projetado e nunca ligado.
--
-- Esta migration NÃO cria o vínculo (já existe): cria a marca de ORIGEM, para
-- que o envio seja idempotente. Mesmo desenho da v67, que fez isso para a
-- Apreciação NR-12 (id_apreciacao_acao + índice único parcial).
--
-- POR QUE UMA COLUNA NOVA E NÃO UM ÍNDICE EM id_risco:
--   `id_risco` é preenchido À MÃO por quem cria a ação na tela /acoes (o
--   formulário oferece o seletor de risco, e 2 linhas da produção já usam).
--   Um índice único ali passaria a PROIBIR duas ações manuais para o mesmo
--   risco — regra que ninguém pediu e que quebraria uso legítimo. A coluna
--   separada restringe só o que o botão gera.
--
-- Aditiva: não altera linha existente, não muda default, não mexe em RLS
-- (a policy de acoes_5w2h vale por linha, não por coluna).
-- ============================================================================

begin;

alter table public.acoes_5w2h
  add column if not exists id_risco_origem text null;

comment on column public.acoes_5w2h.id_risco_origem is
  'V184: risco da inspeção que gerou esta ação pelo botão "Enviar para Plano de Ação". Preenchido só pelo envio automático; o id_risco continua livre para vínculo manual.';

-- Dedupe no BANCO, não só no cliente: duas abas abertas, ou dois técnicos
-- clicando ao mesmo tempo, não podem duplicar a mesma ação no plano.
create unique index if not exists idx_acoes_5w2h_origem_risco
  on public.acoes_5w2h (id_risco_origem)
  where id_risco_origem is not null;

commit;

-- Recarrega o cache de schema do PostgREST (senão a coluna nova volta 404).
notify pgrst, 'reload schema';
