-- V143 — Excluir empresa travava por FK sem cascata.
-- extintores.id_empresa e qps_aplicacoes.id_empresa eram as 2 únicas FKs -> empresas
-- em NO ACTION (as demais 35 são CASCADE; analises_quimicos/investigacoes_acidente
-- são SET NULL de propósito). Como as 2 colunas são NOT NULL, CASCADE é a única
-- opção coerente: apagar a empresa apaga seus extintores/QPS.
-- Espelha o painel-sst v142 (só a parte de FK). Idempotente. Já aplicada via MCP.
alter table public.extintores drop constraint if exists extintores_id_empresa_fkey;
alter table public.extintores
  add constraint extintores_id_empresa_fkey
  foreign key (id_empresa) references public.empresas(id_empresa) on delete cascade;

alter table public.qps_aplicacoes drop constraint if exists qps_aplicacoes_id_empresa_fkey;
alter table public.qps_aplicacoes
  add constraint qps_aplicacoes_id_empresa_fkey
  foreign key (id_empresa) references public.empresas(id_empresa) on delete cascade;
