-- V40 — Módulo "Relatório de Não Conformidade" (RNC)
--
-- Diferente do Conformidade NR (que é checklist por norma), o RNC é uma lista
-- ABERTA de não conformidades encontradas em campo. Cada item descreve uma
-- desvio específico, com evidência fotográfica, causa raiz, ação corretiva
-- proposta, prazo, responsável e status de tratativa.
--
-- Não há catálogo de itens — o auditor adiciona as NCs livremente conforme
-- o que encontra. A norma violada vai como texto livre por item (uma NC pode
-- citar "NR-12 12.5.10" ou "ISO 9001 §5.2" — não amarra a um catálogo).
--
-- Mesmo cabeçalho/assinaturas que o Conformidade NR (empresa, cidade,
-- responsável técnico Chabra, responsável da empresa, data, observações
-- gerais).

create table if not exists public.relatorios_nao_conformidade (
  id_relatorio          text primary key,
  id_empresa            text not null references public.empresas(id_empresa) on delete cascade,

  -- Cabeçalho
  titulo                text not null,        -- título livre ("Auditoria pré-NR-12 jan/2026")
  setor                 text,                 -- texto livre
  responsavel           text,                 -- responsável técnico Chabra (assinante)
  responsavel_empresa   text,                 -- quem acompanhou pelo lado da empresa
  cidade                text,                 -- cidade da auditoria
  data_inspecao         date,
  observacoes_gerais    text,

  -- Status do relatório como um todo
  status                text not null default 'RASCUNHO'
                          check (status in ('RASCUNHO', 'FINALIZADO')),
  finalizado_em         timestamptz,

  -- Auditoria
  usuario_email         text,
  usuario_nome          text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz
);

create index if not exists idx_relatorios_nc_empresa
  on public.relatorios_nao_conformidade (id_empresa, created_at desc);

create index if not exists idx_relatorios_nc_created
  on public.relatorios_nao_conformidade (created_at desc);

alter table public.relatorios_nao_conformidade enable row level security;

drop policy if exists "auth read relatorios_nc"
  on public.relatorios_nao_conformidade;
create policy "auth read relatorios_nc"
  on public.relatorios_nao_conformidade for select to authenticated using (true);

drop policy if exists "auth write relatorios_nc"
  on public.relatorios_nao_conformidade;
create policy "auth write relatorios_nc"
  on public.relatorios_nao_conformidade for all to authenticated
  using (true) with check (true);


-- Itens (NCs) — adicionados livremente pelo auditor
create table if not exists public.relatorios_nao_conformidade_itens (
  id_item                 text primary key,
  id_relatorio            text not null references public.relatorios_nao_conformidade(id_relatorio)
                            on delete cascade,
  ordem                   integer not null default 0,

  -- Núcleo da NC
  descricao               text not null,                 -- o que foi encontrado
  norma_violada           text,                          -- "NR-12 12.5.10" / "ISO 9001 §5.2" — texto livre
  criticidade             text not null default 'MEDIA'
                            check (criticidade in ('ALTA', 'MEDIA', 'BAIXA')),
  causa_raiz              text,
  acao_corretiva          text,
  prazo                   date,
  responsavel_tratativa   text,
  status_tratativa        text not null default 'ABERTA'
                            check (status_tratativa in ('ABERTA', 'EM_TRATAMENTO', 'ENCERRADA')),

  -- Evidência fotográfica (múltiplas fotos por item — bucket `fotos`,
  -- path `nao-conformidade/{id_relatorio}/{id_item}-{sufixo}.{ext}`)
  foto_urls               text[] not null default array[]::text[],
  foto_storage_paths      text[] not null default array[]::text[],

  created_at              timestamptz not null default now(),
  updated_at              timestamptz
);

create index if not exists idx_relatorios_nc_itens_relatorio
  on public.relatorios_nao_conformidade_itens (id_relatorio, ordem);

alter table public.relatorios_nao_conformidade_itens enable row level security;

drop policy if exists "auth read relatorios_nc_itens"
  on public.relatorios_nao_conformidade_itens;
create policy "auth read relatorios_nc_itens"
  on public.relatorios_nao_conformidade_itens for select to authenticated using (true);

drop policy if exists "auth write relatorios_nc_itens"
  on public.relatorios_nao_conformidade_itens;
create policy "auth write relatorios_nc_itens"
  on public.relatorios_nao_conformidade_itens for all to authenticated
  using (true) with check (true);
