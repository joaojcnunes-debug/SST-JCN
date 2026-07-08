-- v119 (JCN) — Fix de 2 lacunas do sync original, achadas no teste E2E (2026-07-08). Via MCP.
-- (1) data_validade faltava em relatorios_(nao_)conformidade → 400 no widget de Validades
--     (visao-geral). O front consulta data_validade dessas tabelas para o alerta de vencimento.
-- (2) investigacoes_acidente sem FK p/ empresas → o embed PostgREST empresas(nome_empresa) na
--     query da LISTA dava 400 e a lista de Investigação de Acidente não carregava.
alter table public.relatorios_conformidade     add column if not exists data_validade date;
alter table public.relatorios_nao_conformidade add column if not exists data_validade date;

alter table public.investigacoes_acidente
  drop constraint if exists investigacoes_acidente_id_empresa_fkey;
alter table public.investigacoes_acidente
  add constraint investigacoes_acidente_id_empresa_fkey
  foreign key (id_empresa) references public.empresas(id_empresa) on delete set null;

create index if not exists idx_investigacoes_acidente_id_empresa
  on public.investigacoes_acidente (id_empresa);
