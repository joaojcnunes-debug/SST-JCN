-- v107 — Investigação de Acidente, Fase 1 (Bloco 1): dados do acidente + ficha
-- completa do acidentado (Itens 5-6). Aditivo/nullable, idempotente. Nada removido.
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
