-- v232 — Log de LEITURA: quem abriu qual módulo, em que dia.
--
-- Diretriz dele (18/09/2026): permissão se define pelo RASTRO de uso de cada
-- pessoa. Só que até aqui o painel só registrava quem GRAVA (autoria das tabelas
-- + auditoria_eventos). Quem só abre a tela para olhar — supervisora, gerente,
-- comercial — não deixava rastro nenhum, e para a régua "usou mais de duas vezes"
-- parecia que nunca tinha usado o módulo. Em 21/09 ele autorizou ("se não custa
-- tanto pode fazer sim").
--
-- O que grava: 1 linha por conta × módulo × dia (chave primária), com a primeira
-- e a última abertura do dia e quantas vezes. No máximo 59 × 17 linhas por dia;
-- na prática umas dezenas. Quem grava é a própria pessoa, pela RPC modulo_abrir,
-- chamada pelo useRequireModule (v0.3.620) quando a checagem de módulo passa —
-- uma vez por módulo por dia em cada navegador. Ninguém percebe.
--
-- Quem lê: Admin e as funções com ve_presenca_auditoria (v231) — a mesma plateia
-- da Presença e da Auditoria. Ninguém edita nem apaga pela API.
--
-- Depende da v229 (usuarios.id_usuario) e da v231 (caller_ve_presenca).
-- Reversível: scripts/sql/v232_rollback_modulo_aberturas.sql (apaga a tabela).

begin;

create table if not exists public.modulo_aberturas (
  id_usuario  text        not null references public.usuarios(id_usuario) on delete cascade,
  modulo      text        not null,
  dia         date        not null default (now() at time zone 'America/Sao_Paulo')::date,
  primeira_em timestamptz not null default now(),
  ultima_em   timestamptz not null default now(),
  vezes       integer     not null default 1,
  primary key (id_usuario, modulo, dia)
);
comment on table public.modulo_aberturas is
  'v232: rastro de LEITURA — quem abriu qual módulo em que dia (1 linha por conta × módulo × dia). Escrita só pela RPC modulo_abrir.';
create index if not exists modulo_aberturas_dia_idx on public.modulo_aberturas (dia desc);

alter table public.modulo_aberturas enable row level security;
drop policy if exists modulo_aberturas_sel on public.modulo_aberturas;
create policy modulo_aberturas_sel on public.modulo_aberturas
  for select to authenticated using (public.caller_ve_presenca());
revoke all on public.modulo_aberturas from public, authenticated, anon;
grant select on public.modulo_aberturas to authenticated;

-- A pessoa registra a própria abertura. Mesmo desenho do presenca_ping (v218):
-- e-mail do JWT → conta interna ativa; sem e-mail (anon/service) ou conta
-- desconhecida, não grava e não reclama.
create or replace function public.modulo_abrir(p_modulo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  claims jsonb;
  v_email text;
  v_id text;
begin
  claims  := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_email := lower(nullif(claims ->> 'email', ''));
  if v_email is null or p_modulo is null or length(p_modulo) > 40 then
    return;
  end if;

  select u.id_usuario into v_id
    from public.usuarios u
   where lower(u.email) = v_email
     and u.ativo_sistema = true
     and u.perfil <> 'Cliente'
   limit 1;
  if v_id is null then
    return;
  end if;

  insert into public.modulo_aberturas (id_usuario, modulo)
  values (v_id, p_modulo)
  on conflict (id_usuario, modulo, dia) do update
     set ultima_em = now(),
         vezes     = public.modulo_aberturas.vezes + 1;
end;
$$;
revoke all on function public.modulo_abrir(text) from public;
grant execute on function public.modulo_abrir(text) to authenticated;


commit;

notify pgrst, 'reload schema';
