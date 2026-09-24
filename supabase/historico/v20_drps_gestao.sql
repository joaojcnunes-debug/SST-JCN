-- V20 — Tabelas de gestão do DRPS (Sub-fase 2b)
--
-- Persiste o plano anual de medidas de controle, o monitoramento por
-- setor×tópico e o checklist de revisão e melhoria contínua.

-- 1) PLANO DE MEDIDAS — calendário anual de 13 ações × 12 meses por empresa.
--    `plano` é um JSON de chave=nome da ação, valor={meses[12], responsavel}.
--    Exemplo: { "DRPS": { "meses": [true,false,...], "responsavel": "RH" } }
create table if not exists public.drps_plano_medidas (
  id_empresa  text not null references public.empresas(id_empresa) on delete cascade,
  ano         smallint not null,
  plano       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (id_empresa, ano)
);

alter table public.drps_plano_medidas enable row level security;
drop policy if exists "auth read drps_plano_medidas" on public.drps_plano_medidas;
create policy "auth read drps_plano_medidas"
  on public.drps_plano_medidas for select to authenticated using (true);
drop policy if exists "auth write drps_plano_medidas" on public.drps_plano_medidas;
create policy "auth write drps_plano_medidas"
  on public.drps_plano_medidas for all to authenticated using (true) with check (true);


-- 2) MONITORAMENTO — acompanhamento por empresa × setor × tópico.
--    Cada linha tem data de intervenção, responsável, status e próxima avaliação.
create table if not exists public.drps_monitoramento (
  id_empresa         text not null references public.empresas(id_empresa) on delete cascade,
  setor              text not null,
  topico_idx         smallint not null check (topico_idx between 0 and 8),
  data_intervencao   date,
  responsavel        text,
  status             text not null default 'Pendente'
                     check (status in ('Pendente','Em Andamento','Concluido','Cancelado')),
  proxima_avaliacao  date,
  observacoes        text,
  updated_at         timestamptz not null default now(),
  primary key (id_empresa, setor, topico_idx)
);

alter table public.drps_monitoramento enable row level security;
drop policy if exists "auth read drps_monitoramento" on public.drps_monitoramento;
create policy "auth read drps_monitoramento"
  on public.drps_monitoramento for select to authenticated using (true);
drop policy if exists "auth write drps_monitoramento" on public.drps_monitoramento;
create policy "auth write drps_monitoramento"
  on public.drps_monitoramento for all to authenticated using (true) with check (true);


-- 3) REVISÃO E MELHORIA — checklist de ações obrigatórias, equipe envolvida
--    e anotações livres, 1 registro por empresa.
create table if not exists public.drps_revisao (
  id_empresa  text primary key references public.empresas(id_empresa) on delete cascade,
  checklist   jsonb not null default '{}'::jsonb,
  equipe      jsonb not null default '{}'::jsonb,
  anotacoes   text,
  updated_at  timestamptz not null default now()
);

alter table public.drps_revisao enable row level security;
drop policy if exists "auth read drps_revisao" on public.drps_revisao;
create policy "auth read drps_revisao"
  on public.drps_revisao for select to authenticated using (true);
drop policy if exists "auth write drps_revisao" on public.drps_revisao;
create policy "auth write drps_revisao"
  on public.drps_revisao for all to authenticated using (true) with check (true);
