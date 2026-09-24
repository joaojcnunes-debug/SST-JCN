-- v209 — Gestão Chabra: F3.A — Google Agenda OUTBOUND (painel → Google).
--
-- Uma tarefa com prazo vira/atualiza/remove um evento na agenda de cada vinculado que
-- conectou a própria conta Google (OAuth por usuário, escopo calendar.events). Este pacote é
-- OUTBOUND-ONLY; o inbound (polling syncToken + watch) é a F3.B.
--
-- Arquitetura (rubrica GESTAO-KANBAN-01-F3.A):
--   • refresh_token cifrado em repouso com pgp_sym_encrypt(token, <ENC_KEY>). A ENC_KEY vem do
--     env da ROTA (server-only) e entra nas RPCs SECURITY DEFINER por PARÂMETRO — nunca persiste
--     em coluna, GUC, log ou resposta. Decifra só o worker de /sync via service_role.
--   • Trigger em gestao_tarefas / gestao_tarefa_vinculados SÓ ENFILEIRA (gestao_google_fila).
--     ZERO HTTP no banco. Guarda anti-loop por GUC gestao.in_google_sync (forward-compat p/ F3.B):
--     quando = 'on', o trigger não enfileira.
--   • /sync (sem pg_cron) drena a fila; dedup por minuto vive na rota (padrão gestao_automacao_tick).
--
-- pgcrypto JÁ existe (1.3) no painel_sst — NÃO emitir create extension.
-- Aditivo/reversível: as 3 tabelas são novas e isoladas; drop no rollback não afeta nada existente.
-- Idempotente 2× (create table if not exists, create or replace function, drop trigger if exists).

-- ── 1) Conta Google por usuário (refresh_token CIFRADO em bytea) ──────────────
-- NO JCN: esta migration foi aplicada sem os "alter function ... owner to
-- chabra_admin" e sem os grants a backup_operator — as duas roles sao do
-- painel self-host e nao existem aqui. As funcoes ficam com o dono padrao
-- (postgres), que ja e quem o SECURITY DEFINER precisa ser, e o dump logico
-- no JCN e responsabilidade do Supabase, nao de uma role de backup.

create table if not exists public.gestao_google_contas (
  usuario_email  text        primary key,
  refresh_token  bytea       not null,                 -- pgp_sym_encrypt(token, ENC_KEY)
  calendar_id    text        not null default 'primary',
  sync_token     text,                                 -- reservado p/ F3.B (inbound)
  channel_id     text,                                 -- reservado p/ F3.B (watch)
  channel_token  text,
  channel_expira timestamptz,
  ativo          boolean     not null default true,
  created_at     timestamptz not null default now()
);

-- ── 2) Mapa de idempotência tarefa↔evento (por usuário) ───────────────────────
create table if not exists public.gestao_google_eventos (
  id_tarefa     text        not null,
  usuario_email text        not null,
  event_id      text        not null,
  etag          text,
  updated_at    timestamptz default now(),
  primary key (id_tarefa, usuario_email)
);

-- ── 3) Fila de reconciliação (o trigger só escreve aqui) ──────────────────────
create table if not exists public.gestao_google_fila (
  id           bigserial    primary key,
  id_tarefa    text,
  operacao     text         not null check (operacao in ('upsert','delete')),
  tentativas   int          not null default 0,
  processado_em timestamptz,
  created_at   timestamptz  not null default now()
);
create index if not exists idx_gestao_google_fila_pendente
  on public.gestao_google_fila (created_at) where processado_em is null;

-- ── 4) Trigger: SÓ ENFILEIRA (zero HTTP), com guarda anti-loop por GUC ────────
-- SECURITY DEFINER (owner chabra_admin) → insere na fila mesmo sem grant de escrita ao caller.
create or replace function public.gestao_google_enfileirar_trg() returns trigger
  language plpgsql security definer set search_path=public as $fn$
declare v_id text; v_op text;
begin
  -- Guarda anti-loop (forward-compat F3.B): escrita de reflexo do próprio sync não re-enfileira.
  if coalesce(current_setting('gestao.in_google_sync', true), '') = 'on' then
    return null;
  end if;

  if tg_table_name = 'gestao_tarefas' then
    if tg_op = 'DELETE' then
      v_id := old.id_tarefa; v_op := 'delete';
    elsif tg_op = 'INSERT' then
      if new.prazo is null then return null; end if;      -- sem prazo → nada a agendar
      v_id := new.id_tarefa; v_op := 'upsert';
    else -- UPDATE
      if new.prazo is not distinct from old.prazo
         and new.data_inicio is not distinct from old.data_inicio
         and new.titulo is not distinct from old.titulo
         and new.status is not distinct from old.status then
        return null;                                       -- nada relevante mudou
      end if;
      v_id := new.id_tarefa; v_op := 'upsert';
    end if;
  else -- gestao_tarefa_vinculados: enfileira a tarefa-mãe (reconcilia a lista de convidados)
    v_id := coalesce(new.id_tarefa, old.id_tarefa); v_op := 'upsert';
  end if;

  insert into public.gestao_google_fila (id_tarefa, operacao) values (v_id, v_op);
  return null;
end $fn$;


drop trigger if exists gestao_google_tarefas_trg on public.gestao_tarefas;
create trigger gestao_google_tarefas_trg
  after insert or update or delete on public.gestao_tarefas
  for each row execute function public.gestao_google_enfileirar_trg();

drop trigger if exists gestao_google_vinculados_trg on public.gestao_tarefa_vinculados;
create trigger gestao_google_vinculados_trg
  after insert or delete on public.gestao_tarefa_vinculados
  for each row execute function public.gestao_google_enfileirar_trg();

-- ── 5) RPCs SECURITY DEFINER search_path=public — a ENC_KEY entra por PARÂMETRO ─
-- Nunca persistem/logam a chave. salvar_conta e ler_token só o worker (service_role) chama.
-- JCN: pgcrypto mora no schema "extensions". Como estas funcoes sao SECURITY
-- DEFINER com search_path fixo em public, pgp_sym_* precisa vir qualificado.
create or replace function public.gestao_google_salvar_conta(
  p_email text, p_refresh_token text, p_enc_key text
) returns void
  language plpgsql security definer set search_path=public as $fn$
begin
  insert into public.gestao_google_contas (usuario_email, refresh_token, ativo)
  values (p_email, extensions.pgp_sym_encrypt(p_refresh_token, p_enc_key), true)
  on conflict (usuario_email) do update
    set refresh_token = extensions.pgp_sym_encrypt(p_refresh_token, p_enc_key),
        ativo = true;
end $fn$;


create or replace function public.gestao_google_ler_token(
  p_email text, p_enc_key text
) returns text
  language plpgsql security definer set search_path=public as $fn$
declare v_tok text;
begin
  select extensions.pgp_sym_decrypt(refresh_token, p_enc_key) into v_tok
    from public.gestao_google_contas
   where usuario_email = p_email and ativo;
  return v_tok;
end $fn$;


-- Só o estado (sem token) — a UI mostra "conectado".
create or replace function public.gestao_google_status(p_email text) returns boolean
  language sql security definer set search_path=public as $fn$
  select coalesce((select ativo from public.gestao_google_contas where usuario_email = p_email), false);
$fn$;


-- ── 6) Fechamento de segurança das 3 tabelas ──────────────────────────────────
-- Tabela nova nasce com SELECT p/ anon/authenticated (default privileges desta base). RLS ON
-- SEM policy p/ anon/authenticated + revoke explícito = dupla tranca. Acesso só via service_role
-- (BYPASSRLS) e via as RPCs SECURITY DEFINER (owner chabra_admin).
alter table public.gestao_google_contas   enable row level security;
alter table public.gestao_google_eventos  enable row level security;
alter table public.gestao_google_fila      enable row level security;

revoke all on public.gestao_google_contas  from authenticated, anon, public;
revoke all on public.gestao_google_eventos from authenticated, anon, public;
revoke all on public.gestao_google_fila     from authenticated, anon, public;

-- contas: worker lê o ciphertext (ativo/calendar_id/sync_token); NUNCA grava direto (só via RPC).
grant select on public.gestao_google_contas to service_role;
-- eventos/fila: o worker reconcilia (drena, marca processado, grava event_id).
grant select, insert, update, delete on public.gestao_google_eventos to service_role;
grant select, insert, update, delete on public.gestao_google_fila     to service_role;
grant usage, select on sequence public.gestao_google_fila_id_seq to service_role;

-- backup_operator=r em eventos/fila (dump lógico). contas FICA DE FORA do backup_operator:
-- guarda segredo cifrado; sem o ENC_KEY é inútil, mas não amplia a superfície do dump.

-- Execução das RPCs: fecha public; abre o mínimo.
revoke all on function public.gestao_google_salvar_conta(text, text, text) from public;
revoke all on function public.gestao_google_ler_token(text, text)          from public;
revoke all on function public.gestao_google_status(text)                    from public;
grant execute on function public.gestao_google_salvar_conta(text, text, text) to service_role;
grant execute on function public.gestao_google_ler_token(text, text)          to service_role;
-- status: sem consumidor na F3.A; só service_role (via rota server-side). Evita que qualquer
-- usuário logado enumere "fulano conectou a Google?" passando p_email arbitrário.
grant execute on function public.gestao_google_status(text)                   to service_role;
