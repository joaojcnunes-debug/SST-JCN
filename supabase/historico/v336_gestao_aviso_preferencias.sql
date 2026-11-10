-- v336 — Gestão › Meu Espaço: cada pessoa liga/desliga os avisos no SINO e por E-MAIL (10/11/2026, 0.3.257).
-- Trazido do Painel SST (v335, 0.3.870).
--   gestao_aviso_preferencias              a escolha de cada um (sem linha = os dois ligados, como sempre foi)
--   gestao_minhas_preferencias_aviso()     lê a minha escolha
--   gestao_salvar_preferencias_aviso()     grava a minha escolha
--   gestao_notificacao_preferencia_trg     BEFORE INSERT em gestao_notificacoes: aplica a escolha do DESTINATÁRIO
-- Todo aviso passa por este gatilho (gestao_avisar, automações, cron diário e o insert do app):
--   sino e e-mail desligados → o aviso não é gravado;
--   e-mail desligado         → canal 'in_app' e email_enviado = true (gestao_aviso_email_reservar só pega
--                              email_enviado = false);
--   sino desligado           → canal 'email' (o sino não lista canal 'email'; o e-mail sai normalmente).
-- Em 10/11 gestao_notificacoes não tinha nenhum gatilho.
--
-- Rollback: scripts/sql/v336_gestao_aviso_preferencias_rollback.sql
begin;

create table if not exists public.gestao_aviso_preferencias (
  usuario_email text primary key check (usuario_email = lower(usuario_email)),
  painel        boolean not null default true,
  email         boolean not null default true,
  updated_at    timestamptz not null default now()
);
alter table public.gestao_aviso_preferencias enable row level security;
revoke all on public.gestao_aviso_preferencias from public, anon, authenticated;
comment on table public.gestao_aviso_preferencias is 'v336: avisos da Gestão no sino (painel) e por e-mail, por pessoa. Só pelas RPCs.';

create or replace function public.gestao_minhas_preferencias_aviso()
returns table (painel boolean, email boolean)
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(p.painel, true), coalesce(p.email, true)
    from (select lower(coalesce(public.gestao_email(), '')) e) eu
    left join public.gestao_aviso_preferencias p on p.usuario_email = eu.e
   where eu.e <> ''
$$;

create or replace function public.gestao_salvar_preferencias_aviso(p_painel boolean, p_email boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_email text := lower(coalesce(public.gestao_email(), ''));
begin
  if v_email = '' then raise exception 'Entre no painel.' using errcode = '42501'; end if;
  insert into public.gestao_aviso_preferencias (usuario_email, painel, email, updated_at)
  values (v_email, coalesce(p_painel, true), coalesce(p_email, true), now())
  on conflict (usuario_email) do update set painel = excluded.painel, email = excluded.email, updated_at = now();
end $$;

revoke all on function public.gestao_minhas_preferencias_aviso() from public, anon;
revoke all on function public.gestao_salvar_preferencias_aviso(boolean, boolean) from public, anon;
grant execute on function public.gestao_minhas_preferencias_aviso() to authenticated;
grant execute on function public.gestao_salvar_preferencias_aviso(boolean, boolean) to authenticated;

create or replace function public.gestao_notificacao_preferencia_trg()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare v record;
begin
  select painel, email into v from public.gestao_aviso_preferencias where usuario_email = lower(coalesce(new.destinatario, ''));
  if not found then return new; end if;                -- sem escolha: como sempre foi
  if not v.painel and not v.email then return null; end if;
  if not v.email then
    new.canal := 'in_app';
    new.email_enviado := true;                         -- a rotina de e-mail só pega email_enviado = false
  elsif not v.painel then
    new.canal := 'email';                              -- o sino não mostra canal 'email'
  end if;
  return new;
end $$;

drop trigger if exists gestao_notificacao_preferencia_trg on public.gestao_notificacoes;
create trigger gestao_notificacao_preferencia_trg
  before insert on public.gestao_notificacoes
  for each row execute function public.gestao_notificacao_preferencia_trg();

notify pgrst, 'reload schema';

commit;
