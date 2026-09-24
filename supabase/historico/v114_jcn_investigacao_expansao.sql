-- v114 (JCN) — Investigação de Acidente: expansão completa (Blocos 1-4, plano 5W2H, 5 Porquês).
-- Reflexo consolidado do painel v107-v111 + v113 + v119. Aplicado via MCP supabase-sst.
-- NOTA: o v119 do painel referenciava 'investigacao_acidente' (singular = bug/no-op);
-- aqui corrigido para 'investigacoes_acidente' (plural, tabela real).

-- Bloco 1 (v107): dados do acidente + ficha do acidentado
alter table public.investigacoes_acidente
  add column if not exists qtd_acidentados integer,
  add column if not exists consequencias text[] not null default '{}',
  add column if not exists fatores_morbi text[] not null default '{}',
  add column if not exists acidentado_cpf text,
  add column if not exists acidentado_pis text,
  add column if not exists acidentado_estado_civil text,
  add column if not exists acidentado_nascimento date,
  add column if not exists acidentado_escolaridade text,
  add column if not exists acidentado_telefone text,
  add column if not exists acidentado_endereco text,
  add column if not exists acidentado_cbo text,
  add column if not exists acidentado_tempo_funcao text,
  add column if not exists acidentado_tempo_empresa text,
  add column if not exists acidentado_jornada text,
  add column if not exists acidentado_tempo_apos_inicio text;

-- Bloco 2a (v108): pessoas, organização, atividade, relatos
alter table public.investigacoes_acidente
  add column if not exists pessoas_envolvidas jsonb not null default '[]'::jsonb,
  add column if not exists organizacao_trabalho jsonb not null default '{}'::jsonb,
  add column if not exists atividade_momento text,
  add column if not exists relatos_envolvidos jsonb not null default '[]'::jsonb;

-- Bloco 2b (v109): mídia
alter table public.investigacoes_acidente
  add column if not exists croqui jsonb not null default '[]'::jsonb,
  add column if not exists mapa_riscos jsonb not null default '[]'::jsonb,
  add column if not exists fotos_anteriores jsonb not null default '[]'::jsonb,
  add column if not exists fotos_momento jsonb not null default '[]'::jsonb,
  add column if not exists fotos_atuais jsonb not null default '[]'::jsonb,
  add column if not exists videos jsonb not null default '[]'::jsonb;

-- Bloco 3 (v110): fatores contribuintes
alter table public.investigacoes_acidente
  add column if not exists fatores_contribuintes jsonb not null default '{}'::jsonb;

-- Bloco 4 (v111): documentação técnica e medidas
alter table public.investigacoes_acidente
  add column if not exists laudos_externos jsonb not null default '[]'::jsonb,
  add column if not exists analise_equipe text,
  add column if not exists consultores jsonb not null default '[]'::jsonb,
  add column if not exists analise_links jsonb not null default '[]'::jsonb,
  add column if not exists medidas_adotadas text,
  add column if not exists cronogramas jsonb not null default '[]'::jsonb,
  add column if not exists fotos_pos jsonb not null default '[]'::jsonb,
  add column if not exists responsavel_legal_nome text,
  add column if not exists responsavel_legal_cargo text,
  add column if not exists responsavel_legal_data date;

-- Plano de ação 5W2H standalone (v113)
create table if not exists public.investigacao_acoes (
  id_acao             text primary key,
  id_investigacao     text not null references public.investigacoes_acidente(id_investigacao) on delete cascade,
  ordem               integer not null default 0,
  what_acao           text not null,
  why_justificativa   text,
  where_local         text,
  when_prazo          date,
  who_responsavel     text,
  how_metodo          text,
  how_much_custo      text,
  status              text not null default 'Pendente' check (status in ('Pendente','Em Andamento','Concluida','Cancelada')),
  prioridade          text not null default 'Media' check (prioridade in ('Baixa','Media','Alta','Critica')),
  data_conclusao      date,
  observacoes         text,
  created_by          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz
);
create index if not exists idx_investigacao_acoes_inv on public.investigacao_acoes (id_investigacao, ordem);
create index if not exists idx_investigacao_acoes_status on public.investigacao_acoes (id_investigacao, status);
alter table public.investigacao_acoes enable row level security;
drop policy if exists "auth read investigacao_acoes" on public.investigacao_acoes;
create policy "auth read investigacao_acoes" on public.investigacao_acoes for select to authenticated using (true);
drop policy if exists "auth write investigacao_acoes" on public.investigacao_acoes;
create policy "auth write investigacao_acoes" on public.investigacao_acoes for all to authenticated using (true) with check (true);

-- 5 Porquês: text[] -> jsonb [{pergunta,resposta}] (v119, FIX plural)
create or replace function public._v119_porques_conv(arr text[]) returns jsonb
  language sql immutable as $f$
    select coalesce(jsonb_agg(jsonb_build_object('pergunta', '', 'resposta', e)), '[]'::jsonb)
    from unnest(arr) e where e is not null and btrim(e) <> '';
  $f$;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='investigacoes_acidente'
      and column_name='cinco_porques' and data_type='ARRAY'
  ) then
    alter table public.investigacoes_acidente alter column cinco_porques drop default;
    alter table public.investigacoes_acidente alter column cinco_porques type jsonb using public._v119_porques_conv(cinco_porques);
    alter table public.investigacoes_acidente alter column cinco_porques set default '[]'::jsonb;
  end if;
end $$;
drop function if exists public._v119_porques_conv(text[]);
