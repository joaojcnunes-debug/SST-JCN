-- v219 — Presença, fase 2: relatório mensal, trilha da auditoria e encerrar sessão.
--
-- Três pedidos dele em 16/09/2026, em cima da v218:
--   1. presenca_uso_mensal(mês, e-mail?)  → minutos ativos por dia civil (RJ), da
--      equipe inteira ou de uma pessoa. Agregado AQUI porque somar os blocos de
--      59 pessoas no navegador seriam ~170 mil linhas por mês.
--   2. presenca_trilha(e-mail, de, até)   → por dia, quantos eventos a pessoa tem
--      na auditoria (v212) e os N últimos, já reduzidos ao que o front precisa
--      para descrever e linkar o registro (lib/auditoria/eventos.ts).
--   3. presenca_encerrar_sessao(e-mail)   → Admin derruba a sessão de alguém:
--      grava o pedido, apaga as sessões do GoTrue (o refresh morre e o servidor
--      rejeita o JWT no próximo getUser()) e o próximo presenca_ping() da pessoa
--      devolve TRUE — o navegador dela desloga sozinho (≤ 1 min se ativa; na
--      volta, se a aba estava parada).
--
-- presenca_ping() muda de `void` para `boolean` por causa do item 3. Postgres não
-- troca o tipo de retorno com CREATE OR REPLACE — daí o DROP antes, e o GRANT de
-- novo depois (o drop leva os grants junto).
--
-- Tudo só Admin (caller_eh_admin(), que vive na produção fora do versionamento).

-- ── 1) Uso mensal ────────────────────────────────────────────────────────────

create or replace function public.presenca_uso_mensal(p_mes date, p_email text default null)
returns table (
  dia        date,
  minutos    integer,
  pessoas    integer,
  entrou_em  timestamptz,
  saiu_em    timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with lim as (
    select date_trunc('month', p_mes)::date                         as ini,
           (date_trunc('month', p_mes) + interval '1 month')::date  as fim
  ),
  j as (
    select (ini::timestamp at time zone 'America/Sao_Paulo') as ini_ts,
           (fim::timestamp at time zone 'America/Sao_Paulo') as fim_ts
      from lim
  )
  select (p.bloco at time zone 'America/Sao_Paulo')::date  as dia,
         sum(least(p.pings, 5))::int                        as minutos,
         count(distinct p.usuario_email)::int               as pessoas,
         min(p.primeiro_em)                                 as entrou_em,
         max(p.ultimo_em)                                   as saiu_em
    from public.presenca_pings p, j
   where p.bloco >= j.ini_ts and p.bloco < j.fim_ts
     and (p_email is null or p.usuario_email = lower(p_email))
     and public.caller_eh_admin()
   group by 1
   order by 1
$$;

comment on function public.presenca_uso_mensal(date, text) is
  'v219 — minutos ativos no painel por dia civil (RJ) no mês; equipe inteira (p_email null) ou uma pessoa. Só Admin.';

-- ── 2) Trilha da auditoria ───────────────────────────────────────────────────
--
-- `ultimos` é um array JSON de eventos com SÓ os campos que o front usa:
-- id, ocorrido_em, acao, modulo, tabela, registro_id, titulo, campos_alterados
-- e um `depois` reduzido às chaves que nomeDoRegistro()/rotaDoRegistro() leem.
-- O antes/depois inteiro de um laudo tem dezenas de KB; aqui não cabe.

create or replace function public.presenca_trilha(
  p_email   text,
  p_de      date,
  p_ate     date,
  p_ultimos integer default 2
)
returns table (
  dia      date,
  total    integer,
  ultimos  jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with j as (
    select (p_de::timestamp         at time zone 'America/Sao_Paulo') as ini_ts,
           ((p_ate + 1)::timestamp  at time zone 'America/Sao_Paulo') as fim_ts
  ),
  ev as (
    select e.id, e.ocorrido_em, e.acao, e.modulo, e.tabela, e.registro_id, e.titulo,
           e.campos_alterados,
           (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
              from jsonb_each(coalesce(e.antes, '{}'::jsonb) || coalesce(e.depois, '{}'::jsonb)) as kv(k, v)
             where k in ('nome_empresa','titulo','nome','descricao','placa','nr_titulo','email',
                         'id_inspecao','id_apreciacao','id_aplicacao')) as linha,
           (e.ocorrido_em at time zone 'America/Sao_Paulo')::date as dia,
           row_number() over (
             partition by (e.ocorrido_em at time zone 'America/Sao_Paulo')::date
             order by e.ocorrido_em desc
           ) as rn
      from public.auditoria_eventos e, j
     where e.usuario_email = lower(p_email)
       and e.ocorrido_em >= j.ini_ts and e.ocorrido_em < j.fim_ts
       and public.caller_eh_admin()
  )
  select ev.dia,
         count(*)::int as total,
         coalesce(
           jsonb_agg(
             jsonb_build_object(
               'id', ev.id, 'ocorrido_em', ev.ocorrido_em, 'acao', ev.acao, 'modulo', ev.modulo,
               'tabela', ev.tabela, 'registro_id', ev.registro_id, 'titulo', ev.titulo,
               'campos_alterados', to_jsonb(ev.campos_alterados),
               'antes', null, 'depois', ev.linha
             ) order by ev.ocorrido_em desc
           ) filter (where ev.rn <= greatest(p_ultimos, 1)),
           '[]'::jsonb
         ) as ultimos
    from ev
   group by ev.dia
   order by ev.dia desc
$$;

comment on function public.presenca_trilha(text, date, date, integer) is
  'v219 — por dia civil (RJ): quantos eventos da auditoria a pessoa tem e os N últimos, reduzidos ao que a tela Presença mostra. Só Admin.';

-- ── 3) Encerrar sessão ───────────────────────────────────────────────────────

create table if not exists public.presenca_encerramentos (
  id             bigserial primary key,
  usuario_email  text        not null,
  pedido_em      timestamptz not null default now(),
  pedido_por     text,
  -- Quando o navegador da pessoa recebeu o TRUE no ping e saiu. Null = ainda
  -- não voltou ao painel (ou fechou a aba antes).
  atendido_em    timestamptz,
  -- Quantas sessões do GoTrue foram apagadas no pedido.
  sessoes_apagadas integer    not null default 0
);

comment on table public.presenca_encerramentos is
  'v219 — pedidos de "encerrar sessão" feitos por Admin na tela Presença: quem, quando, por quem, e quando o navegador da pessoa obedeceu.';

create index if not exists presenca_encerramentos_email_idx
  on public.presenca_encerramentos (usuario_email, pedido_em desc);

create or replace function public.presenca_encerrar_sessao(p_email text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  claims  jsonb;
  v_por   text;
  v_email text;
  n       integer;
begin
  if not public.caller_eh_admin() then
    raise exception 'apenas Admin';
  end if;

  claims  := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_por   := lower(nullif(claims ->> 'email', ''));
  v_email := lower(p_email);

  if v_email is null or v_email = '' then
    raise exception 'e-mail vazio';
  end if;
  if v_email = v_por then
    raise exception 'não dá para encerrar a própria sessão por aqui — use Sair';
  end if;
  if not exists (select 1 from public.usuarios u where lower(u.email) = v_email) then
    raise exception 'usuário não encontrado';
  end if;

  -- Sessões do GoTrue: sem elas o refresh token morre (cascata em
  -- auth.refresh_tokens) e o /user rejeita o JWT pelo session_id.
  delete from auth.sessions s
   using auth.users u
   where s.user_id = u.id and lower(u.email) = v_email;
  get diagnostics n = row_count;

  insert into public.presenca_encerramentos (usuario_email, pedido_por, sessoes_apagadas)
  values (v_email, v_por, n);

  return n;
end;
$$;

comment on function public.presenca_encerrar_sessao(text) is
  'v219 — Admin derruba a sessão de alguém: apaga as sessões do GoTrue e deixa um pedido pendente que o próximo presenca_ping() da pessoa atende. Devolve quantas sessões apagou.';

-- presenca_ping(): agora devolve TRUE quando há pedido de encerramento pendente
-- (e NÃO registra presença nessa chamada — a pessoa está saindo).
drop function if exists public.presenca_ping(text);

create function public.presenca_ping(p_origem text default 'web')
returns boolean
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
    return false;
  end if;

  -- Só conta interna conhecida: Cliente do portal não é colaborador, e e-mail
  -- que não está em usuarios não é ninguém.
  if not exists (
    select 1 from public.usuarios u
     where lower(u.email) = v_email and u.perfil <> 'Cliente'
  ) then
    return false;
  end if;

  -- Pedido de encerramento pendente (últimas 24 h)? Marca como atendido e avisa.
  update public.presenca_encerramentos
     set atendido_em = now()
   where usuario_email = v_email
     and atendido_em is null
     and pedido_em > now() - interval '24 hours';
  if found then
    return true;
  end if;

  v_bloco := to_timestamp(floor(extract(epoch from now()) / 300) * 300);

  insert into public.presenca_pings (usuario_email, bloco, primeiro_em, ultimo_em, pings, origem)
  values (v_email, v_bloco, now(), now(), 1, left(coalesce(p_origem, 'web'), 20))
  on conflict (usuario_email, bloco) do update
    set ultimo_em = now(),
        pings     = public.presenca_pings.pings + 1,
        origem    = coalesce(excluded.origem, public.presenca_pings.origem);

  return false;
end;
$$;

comment on function public.presenca_ping(text) is
  'v218/v219 — registra que quem chama está mexendo no painel agora (upsert no bloco de 5 min). Devolve TRUE se um Admin pediu para encerrar a sessão: o navegador deve deslogar.';

-- ── Permissões ───────────────────────────────────────────────────────────────

alter table public.presenca_encerramentos enable row level security;

drop policy if exists presenca_encerramentos_sel on public.presenca_encerramentos;
create policy presenca_encerramentos_sel on public.presenca_encerramentos
  for select to authenticated using (public.caller_eh_admin());

revoke all on public.presenca_encerramentos from public, authenticated, anon;
grant select on public.presenca_encerramentos to authenticated;

revoke all on function public.presenca_ping(text)                         from public, anon;
revoke all on function public.presenca_uso_mensal(date, text)             from public, anon;
revoke all on function public.presenca_trilha(text, date, date, integer)  from public, anon;
revoke all on function public.presenca_encerrar_sessao(text)              from public, anon;
grant execute on function public.presenca_ping(text)                         to authenticated;
grant execute on function public.presenca_uso_mensal(date, text)             to authenticated;
grant execute on function public.presenca_trilha(text, date, date, integer)  to authenticated;
grant execute on function public.presenca_encerrar_sessao(text)              to authenticated;

notify pgrst, 'reload schema';
