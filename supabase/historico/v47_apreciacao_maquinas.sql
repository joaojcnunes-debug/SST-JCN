-- V47 — Módulo "Apreciação de Máquinas" (NR-12)
--
-- Laudo técnico estruturado por NR-12. Cada apreciação avalia UMA máquina
-- contra um checklist da norma (catálogo estático em
-- `lib/apreciacao-maquinas/catalogo-nr12.ts`). Os itens do catálogo são
-- COPIADOS pra `apreciacoes_maquinas_itens` no momento da criação — mudanças
-- futuras no catálogo não afetam apreciações já emitidas (snapshot
-- regulatório na data da auditoria, mesmo padrão do Relatório de
-- Conformidade NR).
--
-- A máquina pode ser referenciada por FK pro inventário (`id_maquina`) ou
-- como texto livre (`maquina_descricao`) — útil quando a máquina ainda não
-- foi cadastrada no inventário ou pertence a equipamento de terceiros.

create table if not exists public.apreciacoes_maquinas (
  id_apreciacao         text primary key,
  id_empresa            text not null references public.empresas(id_empresa) on delete cascade,

  -- Máquina avaliada (uma das duas formas deve estar preenchida)
  id_maquina            text references public.inventario_maquinas(id_maquina) on delete set null,
  maquina_descricao     text,           -- fallback: nome/modelo/série da máquina como texto livre

  -- Cabeçalho da apreciação
  titulo                text,           -- ex: "Apreciação Prensa Hidráulica setor B - jan/2026"
  setor                 text,
  responsavel           text,           -- responsável técnico Chabra (assinante)
  responsavel_empresa   text,           -- responsável da empresa cliente
  cidade                text,
  data_apreciacao       date,

  -- Conclusão técnica (texto livre após o checklist)
  conclusao_tecnica     text,
  recomendacoes         text,
  risco_residual        text            -- BAIXO | MEDIO | ALTO | CRITICO (texto livre p/ flex)
                          check (risco_residual is null or risco_residual in
                                 ('BAIXO', 'MEDIO', 'ALTO', 'CRITICO')),

  -- Status do laudo
  status                text not null default 'RASCUNHO'
                          check (status in ('RASCUNHO', 'FINALIZADO')),
  finalizado_em         timestamptz,

  -- Auditoria
  observacoes_gerais    text,
  usuario_email         text,
  usuario_nome          text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz
);

create index if not exists idx_apreciacoes_maquinas_empresa
  on public.apreciacoes_maquinas (id_empresa, created_at desc);

create index if not exists idx_apreciacoes_maquinas_maquina
  on public.apreciacoes_maquinas (id_maquina)
  where id_maquina is not null;

create index if not exists idx_apreciacoes_maquinas_status
  on public.apreciacoes_maquinas (status, created_at desc);

create index if not exists idx_apreciacoes_maquinas_created
  on public.apreciacoes_maquinas (created_at desc);

alter table public.apreciacoes_maquinas enable row level security;

drop policy if exists "auth read apreciacoes_maquinas"
  on public.apreciacoes_maquinas;
create policy "auth read apreciacoes_maquinas"
  on public.apreciacoes_maquinas for select to authenticated using (true);

drop policy if exists "auth write apreciacoes_maquinas"
  on public.apreciacoes_maquinas;
create policy "auth write apreciacoes_maquinas"
  on public.apreciacoes_maquinas for all to authenticated
  using (true) with check (true);


-- Itens do checklist NR-12 (snapshot do catálogo estático)
create table if not exists public.apreciacoes_maquinas_itens (
  id_item                text primary key,
  id_apreciacao          text not null references public.apreciacoes_maquinas(id_apreciacao)
                           on delete cascade,

  -- Snapshot do catálogo
  item_codigo            text not null,             -- "12.38.1"
  item_categoria         text not null,             -- "SISTEMAS_SEGURANCA"
  item_titulo            text not null,
  item_descricao         text,
  ordem                  integer not null default 0,

  -- Avaliação
  situacao               text not null default 'PENDENTE'
                           check (situacao in ('CONFORME', 'NAO_CONFORME', 'NAO_APLICAVEL', 'PENDENTE')),
  observacao             text,
  recomendacao           text,           -- ação corretiva sugerida pra item NAO_CONFORME

  -- Evidência fotográfica (múltiplas fotos por item, mesmo padrão do RNC)
  -- Bucket `fotos`, path `apreciacao-maquinas/{id_apreciacao}/{id_item}-{sufixo}.{ext}`
  foto_urls              text[] not null default array[]::text[],
  foto_storage_paths     text[] not null default array[]::text[],

  created_at             timestamptz not null default now(),
  updated_at             timestamptz
);

create index if not exists idx_apreciacoes_maquinas_itens_apreciacao
  on public.apreciacoes_maquinas_itens (id_apreciacao, ordem);

create index if not exists idx_apreciacoes_maquinas_itens_situacao
  on public.apreciacoes_maquinas_itens (id_apreciacao, situacao);

alter table public.apreciacoes_maquinas_itens enable row level security;

drop policy if exists "auth read apreciacoes_maquinas_itens"
  on public.apreciacoes_maquinas_itens;
create policy "auth read apreciacoes_maquinas_itens"
  on public.apreciacoes_maquinas_itens for select to authenticated using (true);

drop policy if exists "auth write apreciacoes_maquinas_itens"
  on public.apreciacoes_maquinas_itens;
create policy "auth write apreciacoes_maquinas_itens"
  on public.apreciacoes_maquinas_itens for all to authenticated
  using (true) with check (true);
