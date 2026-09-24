-- v215 — GESTAO-KANBAN-01-F4: infra de dados p/ a importacao Runrun.it -> Gestao.
--
-- DEV-ONLY nesta entrega: cria a coluna de identidade externa e a tabela de log que a
-- ferramenta scripts/importar-runrun.ts consome. NAO aplica o import (sem creds ainda).
--
-- O que muda:
--   • gestao_tarefas ganha runrun_id (bigint, UNIQUE por indice — chave de idempotencia do
--     upsert) e origem (jsonb — snapshot cru do cartao Runrun: board/stage/type/tags/url).
--     Ambas nullable: as ~centenas de tarefas ja criadas no app ficam com runrun_id NULL
--     (o indice unico admite multiplos NULL) e origem NULL.
--   • nasce gestao_import_log — 1 linha por cartao processado (ok/erro/nao-casado), inclusive
--     o relatorio de alocados sem conta no painel (casamento por e-mail).
--
-- Fechamento de seguranca da tabela nova (licao SEC-GESTAO-01 / feedback_pg_default_privileges:
--   toda tabela nova nasce arwd para authenticated por DEFAULT PRIVILEGES). Padrao v209/v214:
--   RLS ON sem policy p/ anon/authenticated + revoke explicito = dupla tranca. O log so e
--   escrito/lido pelo service_role (a ferramenta roda com POSTGREST_SERVICE_TOKEN / BYPASSRLS);
--   backup_operator=r cobre o dump logico. anon/authenticated: NADA (pode carregar e-mail de
--   alocado nao-casado — nao e superficie de leitura publica).
--
-- Aditivo/reversivel: colunas add-if-not-exists + tabela nova isolada; o rollback dropa tudo.
-- Idempotente 2x: add column if not exists, create table if not exists, create unique index
--   if not exists, revoke/grant convergentes. SEM begin/commit proprio — o apply roda com
--   psql -1 -v ON_ERROR_STOP=1 (uma transacao), como as aditivas v209/v214.

-- (0) Guarda — falha fechada se o alvo nao existir (nao aplicar as cegas). ─────────
-- JCN: a guarda original tambem exigia a role backup_operator (dump do
-- self-host), que nao existe aqui; as demais pre-condicoes continuam valendo.
-- NO JCN: esta migration foi aplicada sem os "alter function ... owner to
-- chabra_admin" e sem os grants a backup_operator — as duas roles sao do
-- painel self-host e nao existem aqui. As funcoes ficam com o dono padrao
-- (postgres), que ja e quem o SECURITY DEFINER precisa ser, e o dump logico
-- no JCN e responsabilidade do Supabase, nao de uma role de backup.

do $guard$
begin
  if to_regclass('public.gestao_tarefas') is null then
    raise exception 'v215: public.gestao_tarefas nao existe — abortado';
  end if;
  if to_regrole('service_role') is null then
    raise exception 'v215: role service_role ausente — a tabela de log dependeria dela; abortado';
  end if;
end
$guard$;

-- (1) Identidade externa + snapshot na tarefa ─────────────────────────────────────
alter table public.gestao_tarefas add column if not exists runrun_id bigint;
alter table public.gestao_tarefas add column if not exists origem    jsonb;

-- UNIQUE por indice (nao por constraint): idempotente com "if not exists" e admite
-- multiplos NULL (as tarefas nativas). Serve de alvo p/ o upsert on_conflict=runrun_id
-- da ferramenta (PostgREST aceita indice unico como resolvedor de conflito).
create unique index if not exists gestao_tarefas_runrun_id_uq
  on public.gestao_tarefas (runrun_id);

comment on column public.gestao_tarefas.runrun_id is
  'Id do cartao no Runrun.it (chave de idempotencia do import F4). NULL nas tarefas nativas.';
comment on column public.gestao_tarefas.origem is
  'Snapshot cru do cartao Runrun no momento do import (board/stage/type/tags/url). Auditoria.';

-- (2) Log de importacao ───────────────────────────────────────────────────────────
create table if not exists public.gestao_import_log (
  id           bigserial   primary key,
  runrun_id    bigint,
  id_tarefa    text,
  board_runrun text,
  resultado    text,
  detalhe      text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_gestao_import_log_runrun
  on public.gestao_import_log (runrun_id);
create index if not exists idx_gestao_import_log_resultado
  on public.gestao_import_log (resultado);

comment on table public.gestao_import_log is
  'Log da ferramenta scripts/importar-runrun.ts (GESTAO-KANBAN-01-F4). 1 linha por cartao: '
  'resultado in (ok|erro|responsavel_nao_casado|seguidor_nao_casado|...), detalhe livre. '
  'Fechada a anon/authenticated; escrita/leitura so por service_role.';

-- (3) Fechamento de seguranca (padrao v209/v214) ─────────────────────────────────
alter table public.gestao_import_log enable row level security;

revoke all on public.gestao_import_log from authenticated, anon, public;

grant select, insert, update, delete on public.gestao_import_log to service_role;
grant usage, select on sequence public.gestao_import_log_id_seq to service_role;

-- dump logico: backup_operator le (espelha gestao_google_eventos/fila da v209).
