-- ============================================================================
-- V208: "Enviar para o Plano de Ação do PGR" — origem da ação no PLANO DO AET
--
-- POR QUE: a NR-17 manda incorporar as medidas da AET ao plano de ação do
-- PGR (item 17.3.6, alínea "b"). O plano do AET nasceu STANDALONE na v207
-- (`aet_acoes`), como os da Investigação e da Apreciação; esta migration abre
-- a porta dele para o `acoes_5w2h` central — o que alimenta o PGR e o Portal
-- do Cliente — do MESMO jeito que a v67 fez para a Apreciação NR-12
-- (`id_apreciacao_acao`) e a v184 para a Inspeção (`id_risco_origem`).
--
-- A coluna é a MARCA DE ORIGEM que torna o envio idempotente: duas abas, dois
-- técnicos, dois cliques — a mesma ação do AET nunca entra duas vezes no
-- plano central. Quem garante é o índice único parcial, no banco, não a tela.
--
-- SEM FK para `aet_acoes`, de propósito (igual `id_apreciacao_acao`): apagar
-- a ação no AET não pode apagar nem anular a cópia que já está no plano do
-- cliente — ela é um compromisso registrado, vive sozinha a partir do envio.
--
-- Aditiva: não altera linha existente, não muda default, não mexe em RLS
-- (a policy de acoes_5w2h vale por linha, não por coluna). Idempotente.
-- ============================================================================

begin;

alter table public.acoes_5w2h
  add column if not exists id_aet_acao text null;

comment on column public.acoes_5w2h.id_aet_acao is
  'V208: ação do plano do AET (aet_acoes.id_acao) que gerou esta pelo botão "Enviar para o Plano de Ação do PGR". Só o envio preenche; sem FK de propósito.';

create unique index if not exists idx_acoes_5w2h_origem_aet
  on public.acoes_5w2h (id_aet_acao)
  where id_aet_acao is not null;

commit;

-- Recarrega o cache de schema do PostgREST (senão a coluna nova volta 404):
--   docker exec db-messages-postgres psql -U chabra_admin -d painel_sst \
--     -c "NOTIFY pgrst, 'reload schema';"
--
-- Desfazer (as ações já copiadas para o plano central FICAM — só perdem a marca):
--   drop index if exists public.idx_acoes_5w2h_origem_aet;
--   alter table public.acoes_5w2h drop column if exists id_aet_acao;
