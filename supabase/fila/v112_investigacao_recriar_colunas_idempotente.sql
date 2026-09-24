-- v112 — Investigação de Acidente: REAPLICA (idempotente) todas as colunas dos
-- Blocos 1-4 (v107-v111). Motivo: no self-host .107 o migrate.ps1 faz "baseline"
-- na 1ª execução (marca migrations como aplicadas SEM rodar). Os v107-v111 foram
-- criados depois do re-dump (28/06) e podem ter caído no baseline → colunas nunca
-- criadas → gravação da investigação falha (PostgREST: coluna inexistente).
-- Por ser uma versão NOVA, o migrate.ps1 roda esta migration e cria o que faltar.
-- Tudo `add column if not exists` → no-op onde já existe (ex.: Supabase hospedado).
alter table public.investigacoes_acidente
  -- Bloco 1 (v107)
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
  add column if not exists acidentado_tempo_apos_inicio text,
  -- Bloco 2a (v108)
  add column if not exists pessoas_envolvidas jsonb not null default '[]'::jsonb,
  add column if not exists organizacao_trabalho jsonb not null default '{}'::jsonb,
  add column if not exists atividade_momento text,
  add column if not exists relatos_envolvidos jsonb not null default '[]'::jsonb,
  -- Bloco 2b (v109)
  add column if not exists croqui jsonb not null default '[]'::jsonb,
  add column if not exists mapa_riscos jsonb not null default '[]'::jsonb,
  add column if not exists fotos_anteriores jsonb not null default '[]'::jsonb,
  add column if not exists fotos_momento jsonb not null default '[]'::jsonb,
  add column if not exists fotos_atuais jsonb not null default '[]'::jsonb,
  add column if not exists videos jsonb not null default '[]'::jsonb,
  -- Bloco 3 (v110)
  add column if not exists fatores_contribuintes jsonb not null default '{}'::jsonb,
  -- Bloco 4 (v111)
  add column if not exists laudos_externos jsonb not null default '[]'::jsonb,
  add column if not exists analise_equipe text,
  add column if not exists consultores jsonb not null default '[]'::jsonb,
  add column if not exists analise_links jsonb not null default '[]'::jsonb,
  add column if not exists medidas_adotadas text,
  add column if not exists cronogramas jsonb not null default '[]'::jsonb,
  add column if not exists fotos_pos jsonb not null default '[]'::jsonb,
  add column if not exists responsavel_legal_nome text,
  add column if not exists responsavel_legal_cargo text,
  add column if not exists responsavel_legal_data date;
