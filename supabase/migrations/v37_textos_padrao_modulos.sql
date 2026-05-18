-- V37 — Textos Padrão por módulo (Painel SST, Conformidade, Análise de Químicos)
--
-- Replica a feature "Texto Padrão" do Psicossocial (tabela `drps_texto_padrao`)
-- para os demais módulos, usando UMA tabela com discriminador `modulo`.
-- O DRPS continua usando sua tabela original — não tocamos nela.
--
-- Cada módulo terá sua própria página em /<modulo>/texto-padrao onde o usuário
-- gerencia capítulos reutilizáveis (com rich-text, imagem de capa opcional e
-- variáveis dinâmicas {{empresa_nome}}, {{cnpj}} etc).

create table if not exists public.textos_padrao (
  id_capitulo       text primary key,
  modulo            text not null check (
    modulo in ('sst', 'conformidade', 'analise_quimicos')
  ),

  ordem             integer not null default 0,
  titulo            text not null,
  conteudo          text,

  -- Capa opcional (imagem de fundo full-page no PDF)
  bg_imagem_url     text,
  caixas_texto      jsonb,

  ativo             boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz
);

create index if not exists idx_textos_padrao_modulo_ordem
  on public.textos_padrao (modulo, ordem);

create index if not exists idx_textos_padrao_ativo
  on public.textos_padrao (ativo);

alter table public.textos_padrao enable row level security;

drop policy if exists "auth read textos_padrao" on public.textos_padrao;
create policy "auth read textos_padrao"
  on public.textos_padrao for select to authenticated using (true);

drop policy if exists "auth write textos_padrao" on public.textos_padrao;
create policy "auth write textos_padrao"
  on public.textos_padrao for all to authenticated
  using (true) with check (true);
