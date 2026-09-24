-- ============================================================================
-- V207: Plano de Ação 5W2H do laudo AET — tabela `aet_acoes` + capítulo fixo
--
-- POR QUE: o AET era o único laudo grande sem plano de ação. A recomendação do
-- setor sai como um parágrafo de prosa (medido em 11/09/2026: 26 de 26 setores
-- com recomendação têm UM <p> só, zero <li>, zero quebra de linha) — não há
-- lista para virar ação sozinha. O plano nasce para o técnico escrever, setor
-- por setor, o que fazer / por quê / quem / quando / como / quanto, e para
-- isso sair impresso no laudo.
--
-- DESENHO: STANDALONE, espelho de `investigacao_acoes` (v113) e de
-- `apreciacao_acoes` (v50). As ações nascem, vivem e morrem com o laudo
-- (`on delete cascade`) e NÃO vão para o `acoes_5w2h` central — igual aos
-- outros dois planos de laudo.
--
-- `id_relatorio` é UUID (o banco real; a memória avisa que o schema do AET não
-- está nas migrations do repo — foi lido do `\d aet_relatorios` em 11/09).
-- `id_setor` é UUID SEM FK, porque os setores do AET são JSONB dentro de
-- `aet_relatorios.setores` — mesmo desenho de `aet_laudo_fatores_psi.id_setor`.
-- Setor apagado deixa a ação sem dono: a tela a mostra em "Ações gerais".
--
-- `when_prazo` já NASCE TEXTO LIVRE. É o pedido do técnico de 26/08 (v185):
-- "imediato", "na próxima parada de manutenção", "30 dias após a entrega dos
-- EPIs" — e aqui não custa migração nenhuma. Ninguém faz conta de data nesta
-- coluna; tela e PDF exibem com `lib/acoes/prazo.ts`.
--
-- RLS: as mesmas duas policies das tabelas-irmãs do AET (`_sel_uni` e
-- `_rw_uni`), que resolvem a unidade pelo relatório pai. GRANTs explícitos —
-- a produção tem default privileges que dariam isso sozinhos, mas depender
-- disso já enganou uma vez (v194).
--
-- CAPÍTULO FIXO: `aet_plano_acao` entra em `textos_padrao` (modulo 'aet') na
-- ordem 145 — entre "Ferramentas Biomecânicas Aplicadas" (140) e
-- "Considerações Finais" (150), lidas da produção em 11/09. Só imprime quando
-- o laudo tem pelo menos uma ação. Posição, título e quebra de página são
-- CONFIGURAÇÃO: o Admin troca em AET › Texto Padrão, sem deploy.
--
-- Idempotente. Não toca em linha existente de nenhuma tabela.
-- ============================================================================

begin;

create table if not exists public.aet_acoes (
  id_acao             text primary key,                     -- "AAC-XXXXXXXX" (gerarId)
  id_relatorio        uuid not null references public.aet_relatorios(id_relatorio)
                        on delete cascade,
  id_setor            uuid,                                 -- setor do JSONB, sem FK (ver cabeçalho)
  ordem               integer not null default 0,
  -- 5W2H
  what_acao           text not null,                        -- O quê
  why_justificativa   text,                                 -- Por quê
  where_local         text,                                 -- Onde
  when_prazo          text,                                 -- Quando (prazo) — TEXTO LIVRE
  who_responsavel     text,                                 -- Quem (responsável)
  how_metodo          text,                                 -- Como (método)
  how_much_custo      text,                                 -- Quanto (custo)
  -- Gestão
  status              text not null default 'Pendente'
                        check (status in ('Pendente','Em Andamento','Concluida','Cancelada')),
  prioridade          text not null default 'Media'
                        check (prioridade in ('Baixa','Media','Alta','Critica')),
  data_conclusao      date,
  observacoes         text,
  -- Auditoria
  created_by          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz
);

comment on table  public.aet_acoes is
  'V207: Plano de Ação 5W2H do laudo AET. Standalone (não vai ao acoes_5w2h central), morre com o relatório.';
comment on column public.aet_acoes.id_setor is
  'Setor do AET (aet_relatorios.setores[].id, JSONB) — sem FK, igual aet_laudo_fatores_psi. NULL = ação geral do laudo.';
comment on column public.aet_acoes.when_prazo is
  'Quando (prazo) do 5W2H — TEXTO LIVRE de nascença (precedente: v185). Exibir com lib/acoes/prazo.ts.';

create index if not exists idx_aet_acoes_rel
  on public.aet_acoes (id_relatorio, ordem);

-- ── RLS — cópia das irmãs (aet_laudo_fatores_psi_sel_uni / _rw_uni) ─────────
alter table public.aet_acoes enable row level security;

drop policy if exists aet_acoes_sel_uni on public.aet_acoes;
create policy aet_acoes_sel_uni
  on public.aet_acoes for select to authenticated
  using (exists (
    select 1 from public.aet_relatorios par
     where par.id_relatorio = aet_acoes.id_relatorio
       and caller_pode_ver_empresa(par.id_empresa)));

drop policy if exists aet_acoes_rw_uni on public.aet_acoes;
create policy aet_acoes_rw_uni
  on public.aet_acoes for all to authenticated
  using (caller_pode_editar() and exists (
    select 1 from public.aet_relatorios par
     where par.id_relatorio = aet_acoes.id_relatorio
       and caller_pode_ver_empresa(par.id_empresa)))
  with check (caller_pode_editar() and exists (
    select 1 from public.aet_relatorios par
     where par.id_relatorio = aet_acoes.id_relatorio
       and caller_pode_ver_empresa(par.id_empresa)));

-- ── GRANTs explícitos (lição da v194: RLS sem GRANT não barra, o Postgres
--    barra ANTES com "permission denied") ────────────────────────────────────
grant select, insert, update, delete on table public.aet_acoes to authenticated;
grant all on table public.aet_acoes to service_role;

-- ── Capítulo fixo do laudo ───────────────────────────────────────────────────
-- id fixo (formato do gerarId("TXT")) para a migration ser idempotente pelo
-- slug e o id não mudar entre ensaio e produção.
insert into public.textos_padrao
  (id_capitulo, modulo, ordem, titulo, conteudo, ativo, orientacao, quebra_pagina,
   posicao_pdf, tipo, slug_fixo, created_at)
select
  'TXT-A7E1D4C0', 'aet', 145, 'Plano de Ação (5W2H)', null, true, 'retrato', 'nova',
  'inicio', 'fixo', 'aet_plano_acao', now()
where not exists (
  select 1 from public.textos_padrao
   where modulo = 'aet' and slug_fixo = 'aet_plano_acao');

commit;

-- Depois de aplicar, recarregar o cache do PostgREST (tabela nova volta 404
-- até isso acontecer):
--   docker exec db-messages-postgres psql -U chabra_admin -d painel_sst \
--     -c "NOTIFY pgrst, 'reload schema';"
--
-- Desfazer (só faz sentido enquanto ninguém cadastrou ação):
--   drop table if exists public.aet_acoes;
--   delete from public.textos_padrao where modulo = 'aet' and slug_fixo = 'aet_plano_acao';
