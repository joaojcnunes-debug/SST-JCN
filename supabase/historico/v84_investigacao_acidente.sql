-- V84 — Módulo Investigação de Acidente de Trabalho
-- Cabeçalho único por investigação; testemunhas e 5 porquês embutidos (JSONB/array).

create table if not exists public.investigacoes_acidente (
  id_investigacao text primary key,
  id_empresa text not null references public.empresas(id_empresa) on delete cascade,

  -- Dados gerais
  data_acidente date,
  hora_acidente text,
  local_acidente text,
  setor text,
  data_investigacao date,
  responsavel_tecnico text,
  numero_cat text,
  data_cat date,

  -- Acidentado
  acidentado_nome text,
  acidentado_cargo text,
  acidentado_admissao date,
  tipo_acidente text,                 -- TIPICO | TRAJETO | DOENCA
  houve_afastamento boolean not null default false,
  dias_afastamento integer,
  gravidade text,                     -- LEVE | GRAVE | FATAL

  -- Descrição
  descricao text,
  agente_causador text,
  parte_corpo text,
  natureza_lesao text,
  cid text,

  -- Testemunhas: [{ nome, depoimento }]
  testemunhas jsonb not null default '[]'::jsonb,

  -- Análise de causas
  causas_imediatas text,
  causas_basicas text,
  cinco_porques text[] not null default '{}',   -- respostas dos "Por quê?" em ordem

  -- Medidas + conclusão
  medidas text,
  conclusao text,

  -- Evidências
  foto_urls text[] not null default '{}',
  foto_legendas text[] not null default '{}',

  -- Controle
  status text not null default 'RASCUNHO',       -- RASCUNHO | CONCLUIDA | DELETADA
  data_validade date,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists idx_investig_acidente_empresa on public.investigacoes_acidente (id_empresa);
create index if not exists idx_investig_acidente_status on public.investigacoes_acidente (status);

-- RLS no padrão dos demais módulos por empresa (isolamento por unidade).
alter table public.investigacoes_acidente enable row level security;

drop policy if exists investig_select on public.investigacoes_acidente;
create policy investig_select on public.investigacoes_acidente
  for select to authenticated
  using (public.caller_pode_ver_empresa(id_empresa));

drop policy if exists investig_insert on public.investigacoes_acidente;
create policy investig_insert on public.investigacoes_acidente
  for insert to authenticated
  with check (public.caller_pode_editar() and public.caller_pode_ver_empresa(id_empresa));

drop policy if exists investig_update on public.investigacoes_acidente;
create policy investig_update on public.investigacoes_acidente
  for update to authenticated
  using (public.caller_pode_editar() and public.caller_pode_ver_empresa(id_empresa))
  with check (public.caller_pode_editar() and public.caller_pode_ver_empresa(id_empresa));

drop policy if exists investig_delete on public.investigacoes_acidente;
create policy investig_delete on public.investigacoes_acidente
  for delete to authenticated
  using (public.caller_pode_editar() and public.caller_pode_ver_empresa(id_empresa));
