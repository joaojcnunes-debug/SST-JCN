-- V50 — Plano de ação STANDALONE da Apreciação NR-12
--
-- Decisão arquitetural: o plano de ação da apreciação fica VINCULADO ao
-- laudo (não compartilha com `acoes_5w2h` do Painel SST). Razão: o
-- auditor da NR-12 quer entregar TUDO em um único documento, sem
-- depender que o cliente acesse a tela /acoes do Painel pra ver o que
-- precisa fazer. As ações nascem, vivem e morrem junto com o laudo.
--
-- A coluna `id_apreciacao_item` em `acoes_5w2h` (v49) fica órfã/dormente
-- — sem dados a serem usados. Pode ser removida numa migração posterior
-- se confirmado que ninguém usa.
--
-- Estrutura: mesmos 7 campos 5W2H + status + prioridade, mas escopado
-- por apreciação (e item NÃO CONFORME quando aplicável).

create table if not exists public.apreciacao_acoes (
  id_acao             text primary key,
  id_apreciacao       text not null references public.apreciacoes_maquinas(id_apreciacao)
                        on delete cascade,
  /** Item NÃO CONFORME que originou a ação. Nullable porque o auditor
   *  pode adicionar ações "gerais" do laudo (ex: revisão completa do PGR). */
  id_item             text references public.apreciacoes_maquinas_itens(id_item)
                        on delete set null,
  ordem               integer not null default 0,

  -- 5W2H
  what_acao           text not null,           -- O quê
  why_justificativa   text,                    -- Por quê
  where_local         text,                    -- Onde
  when_prazo          date,                    -- Quando (prazo de execução)
  who_responsavel     text,                    -- Quem (responsável)
  how_metodo          text,                    -- Como (método)
  how_much_custo      text,                    -- Quanto (estimativa de custo)

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

create index if not exists idx_apreciacao_acoes_apreciacao
  on public.apreciacao_acoes (id_apreciacao, ordem);

create index if not exists idx_apreciacao_acoes_item
  on public.apreciacao_acoes (id_item)
  where id_item is not null;

create index if not exists idx_apreciacao_acoes_status
  on public.apreciacao_acoes (id_apreciacao, status);

alter table public.apreciacao_acoes enable row level security;

drop policy if exists "auth read apreciacao_acoes" on public.apreciacao_acoes;
create policy "auth read apreciacao_acoes"
  on public.apreciacao_acoes for select to authenticated using (true);

drop policy if exists "auth write apreciacao_acoes" on public.apreciacao_acoes;
create policy "auth write apreciacao_acoes"
  on public.apreciacao_acoes for all to authenticated
  using (true) with check (true);
