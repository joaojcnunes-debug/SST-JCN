-- v113 — Plano de ação 5W2H STANDALONE da Investigação de Acidente. Espelha
-- apreciacao_acoes (v50): as ações nascem, vivem e morrem junto com a investigação
-- e o laudo (NÃO compartilham com acoes_5w2h central). Permite múltiplas linhas 5W2H.
create table if not exists public.investigacao_acoes (
  id_acao             text primary key,
  id_investigacao     text not null references public.investigacoes_acidente(id_investigacao)
                        on delete cascade,
  ordem               integer not null default 0,
  -- 5W2H
  what_acao           text not null,           -- O quê
  why_justificativa   text,                    -- Por quê
  where_local         text,                    -- Onde
  when_prazo          date,                    -- Quando (prazo)
  who_responsavel     text,                    -- Quem (responsável)
  how_metodo          text,                    -- Como (método)
  how_much_custo      text,                    -- Quanto (custo)
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
create index if not exists idx_investigacao_acoes_inv
  on public.investigacao_acoes (id_investigacao, ordem);
create index if not exists idx_investigacao_acoes_status
  on public.investigacao_acoes (id_investigacao, status);
alter table public.investigacao_acoes enable row level security;
drop policy if exists "auth read investigacao_acoes" on public.investigacao_acoes;
create policy "auth read investigacao_acoes"
  on public.investigacao_acoes for select to authenticated using (true);
drop policy if exists "auth write investigacao_acoes" on public.investigacao_acoes;
create policy "auth write investigacao_acoes"
  on public.investigacao_acoes for all to authenticated
  using (true) with check (true);
