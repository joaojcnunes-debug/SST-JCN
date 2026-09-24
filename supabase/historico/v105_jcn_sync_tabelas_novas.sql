-- v105 (JCN sync 2026-06-26) — 13 tabelas de features do painel mais novas que a v0.3.54.
-- DDL extraído do schema vivo do painel (sem FK, aditivo). Aplicado via MCP supabase-sst.
create table if not exists public.anexos (
  id_anexo uuid not null default gen_random_uuid(), modulo text not null, id_referencia text not null,
  nome text not null, descricao text, storage_path text not null, url text not null, mime text, tamanho_bytes bigint,
  tipo text not null default 'arquivo'::text, ordem integer not null default 0, incluir_no_pdf boolean not null default true,
  criado_por text, created_at timestamptz not null default now(), empresa_id text, vinculo_tipo text, vinculo_id text,
  validade date, obrigatorio boolean not null default false, capitulo_destino text, mostrar_no_corpo boolean not null default false,
  PRIMARY KEY (id_anexo)
);
create table if not exists public.apreciacao_riscos_hrn (
  id_risco text not null, id_apreciacao text not null, tipo_perigo text not null, origem text, potenciais_consequencias text,
  pod text, fep text, gpd text, npe_item text, classificacao_risco text, nivel_acoes text, medidas_preventivas text,
  ordem integer default 0, created_at timestamptz default now(), PRIMARY KEY (id_risco)
);
create table if not exists public.document_audit_logs (
  id uuid not null default gen_random_uuid(), modulo text not null, id_referencia text, acao text not null, descricao text,
  empresa_id text, usuario_email text, metadata jsonb, created_at timestamptz not null default now(), PRIMARY KEY (id)
);
create table if not exists public.drps_agravos (
  id text not null default (gen_random_uuid())::text, titulo text not null, ativo boolean not null default true,
  ordem integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz, PRIMARY KEY (id)
);
create table if not exists public.drps_medidas_recomendadas (
  id text not null default (gen_random_uuid())::text, titulo text not null, ativo boolean not null default true,
  ordem integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz, PRIMARY KEY (id)
);
create table if not exists public.drps_plano_acao_5w2h (
  id uuid not null default gen_random_uuid(), id_relatorio text not null, id_empresa text, ordem integer not null default 0,
  acao text, justificativa text, onde text, prazo text, responsavel text, como text, quanto_custa text,
  status text not null default 'PENDENTE'::text, created_at timestamptz not null default now(), updated_at timestamptz, PRIMARY KEY (id)
);
create table if not exists public.investigacoes_acidente (
  id_investigacao text not null, id_empresa text not null, data_acidente date, hora_acidente text, local_acidente text, setor text,
  data_investigacao date, responsavel_tecnico text, numero_cat text, data_cat date, acidentado_nome text, acidentado_cargo text,
  acidentado_admissao date, tipo_acidente text, houve_afastamento boolean not null default false, dias_afastamento integer, gravidade text,
  descricao text, agente_causador text, parte_corpo text, natureza_lesao text, cid text, testemunhas jsonb not null default '[]'::jsonb,
  causas_imediatas text, causas_basicas text, cinco_porques text[] not null default '{}'::text[], medidas text, conclusao text,
  foto_urls text[] not null default '{}'::text[], foto_legendas text[] not null default '{}'::text[], status text not null default 'RASCUNHO'::text,
  data_validade date, created_at timestamptz not null default now(), updated_at timestamptz, setores text[] not null default '{}'::text[],
  acidentado_funcoes text[] not null default '{}'::text[], partes_corpo text[] not null default '{}'::text[], ishikawa jsonb not null default '{}'::jsonb,
  PRIMARY KEY (id_investigacao)
);
create table if not exists public.prod_colaborador_unidade (
  id uuid not null default gen_random_uuid(), id_colaborador uuid not null, id_unidade uuid not null,
  percentual smallint not null default 100, criado_em timestamptz not null default now(),
  UNIQUE (id_colaborador, id_unidade), CHECK (((percentual >= 0) AND (percentual <= 100))), PRIMARY KEY (id)
);
create table if not exists public.prod_projecoes_salvas (
  id uuid not null default gen_random_uuid(), titulo text not null, tipo text not null default 'geral'::text, id_unidade uuid, nome_unidade text,
  dias_uteis integer not null default 60, adms_atuais integer not null default 15, tecnicos_atuais integer not null default 9,
  docs_por_adm_dia numeric not null default 5, insp_por_tec_dia numeric not null default 3, dados_unidades jsonb not null default '{}'::jsonb,
  observacao text, comentarios text, total_clientes integer, pend_inspecao integer, pend_docs integer, adms_necessarios integer,
  tecs_necessarios integer, adms_adicionais integer, tecs_adicionais integer, criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(), PRIMARY KEY (id)
);
create table if not exists public.prod_snapshot_mensal (
  id uuid not null default gen_random_uuid(), id_unidade uuid not null, mes smallint not null, ano smallint not null,
  clientes_pagantes integer not null default 0, clientes_cortesia integer not null default 0, vencidos integer not null default 0,
  vencendo integer not null default 0, inspecao_pendente integer not null default 0, criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(), UNIQUE (id_unidade, mes, ano), CHECK (((mes >= 1) AND (mes <= 12))), PRIMARY KEY (id)
);
create table if not exists public.registros_excluidos (
  id uuid not null default gen_random_uuid(), tabela text not null, registro_id text not null, rotulo text, dados jsonb not null,
  modulo text, excluido_por text, excluido_em timestamptz not null default now(), restaurado boolean not null default false,
  restaurado_por text, restaurado_em timestamptz, chave text, tipo_exclusao text not null default 'hard'::text, PRIMARY KEY (id)
);
create table if not exists public.textos_padrao_versoes (
  id_versao uuid not null default gen_random_uuid(), id_capitulo text not null, versao integer not null, modulo text not null,
  titulo text not null default ''::text, conteudo text, bg_imagem_url text, caixas_texto jsonb, orientacao text, quebra_pagina text,
  posicao_pdf text, tipo text, slug_fixo text, ordem integer, ativo boolean, editado_por text, editado_em timestamptz not null default now(),
  UNIQUE (id_capitulo, versao), PRIMARY KEY (id_versao)
);
create table if not exists public.unidades (
  id_unidade text not null, nome text not null, created_at timestamptz not null default now(), updated_at timestamptz, PRIMARY KEY (id_unidade)
);
