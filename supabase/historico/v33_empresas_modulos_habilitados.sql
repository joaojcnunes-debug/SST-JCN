-- V33 — Separação de visibilidade de empresas por módulo
--
-- Cada empresa agora declara em quais módulos ela está habilitada. O
-- EmpresaSelect de cada módulo filtra apenas empresas com o módulo
-- correspondente marcado.
--
-- Valores válidos do array:
--   'sst'          — Painel SST (Inspeções)
--   'psicossocial' — Módulo Psicossocial
--   'conformidade' — Relatório de Conformidade NR
--   'analise_quimicos' — Análise de Químicos
--
-- DEFAULT: todos os módulos atuais → empresas existentes ficam visíveis em
-- todos os quadros (zero breaking change). Admin pode editar depois pra
-- restringir.

alter table public.empresas
  add column if not exists modulos_habilitados text[]
    not null
    default array['sst', 'psicossocial', 'conformidade', 'analise_quimicos'];

-- Backfill defensivo (em alguns casos o default não se aplica retroativamente
-- a linhas existentes dependendo da versão do Postgres; a forma idempotente é:
update public.empresas
  set modulos_habilitados = array['sst', 'psicossocial', 'conformidade', 'analise_quimicos']
  where modulos_habilitados is null or cardinality(modulos_habilitados) = 0;

-- Índice GIN pra acelerar filtros tipo `modulos_habilitados @> array['sst']`
create index if not exists idx_empresas_modulos_habilitados
  on public.empresas using gin (modulos_habilitados);
