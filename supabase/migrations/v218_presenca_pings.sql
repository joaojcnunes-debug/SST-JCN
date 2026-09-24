-- v218 — Presença no painel: quem está mexendo, desde quando, por quanto tempo.
--
-- O QUE MEDE. Atividade NO PAINEL: mouse, teclado, toque ou rolagem com a aba
-- visível. Não mede trabalho — o técnico em campo com o app offline não gera
-- nada aqui, e nem deveria. O rótulo na tela diz "atividade no painel" de
-- propósito.
--
-- COMO GRAVA. O navegador chama presenca_ping() uma vez por minuto ENQUANTO a
-- pessoa mexe (lib/hooks/usePresencaPing.ts). O banco não guarda um log de
-- eventos: guarda UMA linha por pessoa por bloco de 5 minutos (upsert). Aba
-- parada = sem ping = sem linha. Disso sai tudo que a tela precisa:
--   entrou        = 1º bloco do dia
--   parou         = último bloco do dia
--   tempo ativo   = minutos com ping (least(pings, 5) por bloco)
--   inativo há    = agora − ultimo_em
--   deixou de vir = dias sem nenhum bloco
--
-- QUEM É QUEM. presenca_ping() lê o e-mail DO JWT (mesmo caminho do gatilho de
-- auditoria v212): ninguém bate ponto por outro. Perfil Cliente (portal) não
-- entra — não é colaborador.
--
-- QUEM LÊ. Só Admin, por caller_eh_admin() (função que vive na produção, fora do
-- versionamento — mesma que v103/v212 usam). Nenhuma conta escreve na tabela
-- direto: a escrita é exclusiva da função SECURITY DEFINER.
--
-- VOLUME. No máximo 96 linhas/pessoa/dia (24 h ÷ 5 min); 30 contas × 22 dias
-- úteis ≈ 60 mil linhas/mês, ~6 MB. Retenção: nenhuma por ora — como a
-- auditoria, precisa de dono (ver presenca_limpar() abaixo, manual).

create table if not exists public.presenca_pings (
  usuario_email text        not null,
  -- Início do bloco de 5 min, em UTC (floor(epoch/300)*300).
  bloco         timestamptz not null,
  primeiro_em   timestamptz not null default now(),
  ultimo_em     timestamptz not null default now(),
  -- Quantos pings caíram no bloco (≈ minutos ativos, teto 5 na leitura).
  pings         integer     not null default 1,
  -- 'web' | 'electron' | 'pwa' — de onde a pessoa está usando.
  origem        text,
  primary key (usuario_email, bloco)
);

comment on table public.presenca_pings is
  'v218 — presença no painel: uma linha por pessoa por bloco de 5 min em que ela mexeu no painel. Gravada só por presenca_ping(); só Admin lê.';

create index if not exists presenca_pings_bloco_idx
  on public.presenca_pings (bloco desc);

-- ── Escrita: o próprio usuário, pelo JWT ─────────────────────────────────────

create or replace function public.presenca_ping(p_origem text default 'web')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  claims  jsonb;
  v_email text;
  v_bloco timestamptz;
begin
  claims  := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_email := lower(nullif(claims ->> 'email', ''));

  -- Sem e-mail no token (anon/service) não é pessoa: não grava.
  if v_email is null then
    return;
  end if;

  -- Só conta interna conhecida: Cliente do portal não é colaborador, e e-mail
  -- que não está em usuarios não é ninguém.
  if not exists (
    select 1 from public.usuarios u
     where lower(u.email) = v_email and u.perfil <> 'Cliente'
  ) then
    return;
  end if;

  v_bloco := to_timestamp(floor(extract(epoch from now()) / 300) * 300);

  insert into public.presenca_pings (usuario_email, bloco, primeiro_em, ultimo_em, pings, origem)
  values (v_email, v_bloco, now(), now(), 1, left(coalesce(p_origem, 'web'), 20))
  on conflict (usuario_email, bloco) do update
    set ultimo_em = now(),
        pings     = public.presenca_pings.pings + 1,
        origem    = coalesce(excluded.origem, public.presenca_pings.origem);
end;
$$;

comment on function public.presenca_ping(text) is
  'v218 — registra que quem chama está mexendo no painel agora. E-mail vem do JWT; upsert no bloco de 5 min corrente.';

-- ── Leitura: resumo do dia por pessoa (só Admin) ─────────────────────────────
--
-- p_dia é o dia CIVIL em America/Sao_Paulo (o painel é da Chabra, RJ). Devolve
-- TODAS as contas internas ativas, inclusive quem não entrou (entrou_em null) —
-- é justamente quem a tela quer destacar. ultima_atividade_geral é o último
-- ping em qualquer dia, para o "há 6 dias".

create or replace function public.presenca_resumo(p_dia date default null)
returns table (
  usuario_email           text,
  nome                    text,
  perfil                  text,
  cargo                   text,
  entrou_em               timestamptz,
  ultima_atividade        timestamptz,
  blocos                  integer,
  minutos_ativos          integer,
  ultima_atividade_geral  timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with dia as (
    select coalesce(p_dia, (now() at time zone 'America/Sao_Paulo')::date) as d
  ),
  janela as (
    select (d::timestamp       at time zone 'America/Sao_Paulo') as ini,
           ((d + 1)::timestamp at time zone 'America/Sao_Paulo') as fim
      from dia
  ),
  do_dia as (
    select p.usuario_email,
           min(p.primeiro_em)                 as entrou_em,
           max(p.ultimo_em)                   as ultima_atividade,
           count(*)::int                      as blocos,
           sum(least(p.pings, 5))::int        as minutos_ativos
      from public.presenca_pings p, janela j
     where p.bloco >= j.ini and p.bloco < j.fim
     group by p.usuario_email
  ),
  geral as (
    select p.usuario_email, max(p.ultimo_em) as ultima_geral
      from public.presenca_pings p
     group by p.usuario_email
  )
  select lower(u.email),
         u.nome,
         u.perfil::text,
         u.cargo,
         d.entrou_em,
         d.ultima_atividade,
         coalesce(d.blocos, 0),
         coalesce(d.minutos_ativos, 0),
         g.ultima_geral
    from public.usuarios u
    left join do_dia d on d.usuario_email = lower(u.email)
    left join geral  g on g.usuario_email = lower(u.email)
   where u.ativo_sistema
     and u.perfil <> 'Cliente'
     and public.caller_eh_admin()   -- quem não é Admin recebe lista vazia
   order by u.nome
$$;

comment on function public.presenca_resumo(date) is
  'v218 — por conta interna ativa: quando entrou, última atividade e minutos ativos no dia (America/Sao_Paulo). Só Admin; os demais recebem vazio.';

-- ── Limpeza (manual, sem cron): apaga blocos com mais de p_dias ──────────────

create or replace function public.presenca_limpar(p_dias integer default 400)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not public.caller_eh_admin() then
    raise exception 'apenas Admin';
  end if;
  delete from public.presenca_pings
   where bloco < now() - make_interval(days => greatest(p_dias, 30));
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ── Permissões ───────────────────────────────────────────────────────────────

alter table public.presenca_pings enable row level security;

drop policy if exists presenca_pings_sel on public.presenca_pings;
create policy presenca_pings_sel on public.presenca_pings
  for select to authenticated using (public.caller_eh_admin());

revoke all on public.presenca_pings from public, authenticated, anon;
grant select on public.presenca_pings to authenticated;

revoke all on function public.presenca_ping(text)      from public, anon;
revoke all on function public.presenca_resumo(date)    from public, anon;
revoke all on function public.presenca_limpar(integer) from public, anon;
grant execute on function public.presenca_ping(text)      to authenticated;
grant execute on function public.presenca_resumo(date)    to authenticated;
grant execute on function public.presenca_limpar(integer) to authenticated;

notify pgrst, 'reload schema';
