-- v116 — Gestão Chabra: evolução do acesso (Fase 2 do módulo de permissões).
--
-- MODELO (validado com o operador):
--  • Roster próprio  → gestao_membros (papel owner/admin/membro) É O PORTÃO: quem não é
--    membro ativo não acessa a Gestão. SST Admin = Owner (bypass + seed) p/ não travar.
--  • Acesso a recursos → compartilhamento MANUAL em gestao_acessos (4 níveis + herança
--    Espaço/Pasta/Lista/Tarefa + flag rebaixadora). SEM eixo unidade (é tudo manual).
--  • Acesso DESACOPLADO do perfil SST (gestão auto-contida): o que o membro pode fazer
--    vem só do nível na Lista.
--  • Rastreabilidade → gestao_acesso_log (append-only, motivo obrigatório) + RPCs atômicas
--    (única via de escrita de acesso/roster; sem log → rollback).
--
-- ADITIVA/idempotente/reversível. Mantém gestao_pode_ver()/gestao_pode_editar_q() + as
-- policies da v103 INTACTAS (o app atual segue igual); o modelo novo fica DORMENTE até a
-- Fase 3 (app + virada das policies). FORA: empresa/portal/assinatura/eSocial/unidade.

-- ── 1) Enums ────────────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname='gestao_nivel')  then create type public.gestao_nivel  as enum ('view','comment','edit','full'); end if;
  if not exists (select 1 from pg_type where typname='gestao_recurso') then create type public.gestao_recurso as enum ('space','folder','list','task'); end if;
  if not exists (select 1 from pg_type where typname='gestao_papel')   then create type public.gestao_papel   as enum ('owner','admin','membro'); end if;
  if not exists (select 1 from pg_type where typname='gestao_acao')    then create type public.gestao_acao    as enum ('concedeu','revogou','alterou_nivel','convidou','removeu','alterou_papel'); end if;
end $$;
-- Garante o valor novo caso o enum já exista de uma aplicação anterior (idempotente).
alter type public.gestao_acao add value if not exists 'alterou_papel';

create or replace function public.gestao_nivel_ord(n public.gestao_nivel) returns int
  language sql immutable as $$ select case n when 'view' then 1 when 'comment' then 2 when 'edit' then 3 when 'full' then 4 end $$;

-- ── 2) Roster de membros (o PORTÃO de entrada) ──────────────────────────────
create table if not exists public.gestao_membros (
  id uuid primary key default gen_random_uuid(),
  usuario_email  text not null,
  papel          public.gestao_papel not null default 'membro',
  ativo          boolean not null default true,
  adicionado_por text,
  created_at     timestamptz not null default now()
);
create unique index if not exists uq_gestao_membros_email on public.gestao_membros (lower(usuario_email));

-- Papel efetivo na Gestão: SST Admin = owner (bypass); senão o do roster; NULL = não-membro.
create or replace function public.gestao_papel_de(p_email text) returns public.gestao_papel
  language plpgsql stable security definer set search_path=public as $$
declare v_perfil text; v_papel public.gestao_papel;
begin
  select perfil into v_perfil from public.usuarios where lower(email)=lower(p_email) limit 1;
  if v_perfil = 'Admin' then return 'owner'; end if;
  select papel into v_papel from public.gestao_membros where lower(usuario_email)=lower(p_email) and ativo limit 1;
  return v_papel;
end $$;

create or replace function public.gestao_eh_gestor(p_email text) returns boolean
  language sql stable security definer set search_path=public as $$
  select public.gestao_papel_de(p_email) in ('owner','admin');
$$;

-- Seed: Admins do SST viram Owner no roster (idempotente).
insert into public.gestao_membros (usuario_email, papel, adicionado_por)
  select u.email, 'owner', 'seed:v116' from public.usuarios u
  where u.perfil='Admin' and coalesce(u.ativo_sistema, true)
    and not exists (select 1 from public.gestao_membros m where lower(m.usuario_email)=lower(u.email));

alter table public.gestao_membros enable row level security;
drop policy if exists gestao_membros_sel on public.gestao_membros;
create policy gestao_membros_sel on public.gestao_membros for select to authenticated
  using (public.gestao_eh_gestor(public.gestao_email()));
-- Sem policy de escrita direta: roster muda só via gestao_definir_membro (SECURITY DEFINER).

-- ── 3) gestao_acessos: modelo genérico por recurso + 4 níveis (mantém id_quadro/papel) ──
alter table public.gestao_acessos
  add column if not exists recurso_tipo  public.gestao_recurso,
  add column if not exists recurso_id    text,
  add column if not exists nivel         public.gestao_nivel,
  add column if not exists restritivo    boolean not null default false,
  add column if not exists concedido_por text;

update public.gestao_acessos set
  recurso_tipo = coalesce(recurso_tipo, 'list'),
  recurso_id   = coalesce(recurso_id, id_quadro),
  nivel        = coalesce(nivel, case when papel='editor' then 'edit'::public.gestao_nivel else 'view'::public.gestao_nivel end)
where recurso_id is null or nivel is null;

create unique index if not exists uq_gestao_acessos_recurso on public.gestao_acessos (lower(usuario_email), recurso_tipo, recurso_id);
create index if not exists idx_gestao_acessos_recurso on public.gestao_acessos (recurso_tipo, recurso_id);

-- ── 4) Log append-only (INSERT+SELECT; motivo ≥ 5; SELECT só gestor) ────────
create table if not exists public.gestao_acesso_log (
  id uuid primary key default gen_random_uuid(),
  ator_email text not null, alvo_email text not null, acao public.gestao_acao not null,
  recurso_tipo public.gestao_recurso, recurso_id text,
  nivel_anterior public.gestao_nivel, nivel_novo public.gestao_nivel,
  motivo text not null check (length(trim(motivo)) >= 5), created_at timestamptz not null default now()
);
alter table public.gestao_acesso_log enable row level security;
drop policy if exists gestao_acesso_log_sel on public.gestao_acesso_log;
create policy gestao_acesso_log_sel on public.gestao_acesso_log for select to authenticated using (public.gestao_eh_gestor(public.gestao_email()));
-- Sem policy de INSERT direto: log nasce só dentro das RPCs (SECURITY DEFINER). Sem UPDATE/DELETE.

-- ── 5) Resolver de nível (membership + hierarquia + rebaixador) ─────────────
-- Não-membro → NULL (portão). Gestor (owner/admin) → full. Membro → gestao_acessos + herança.
-- SEM teto por perfil SST (desacoplado). SEM unidade.
create or replace function public.gestao_resolver_nivel(p_email text, p_recurso_tipo public.gestao_recurso, p_recurso_id text)
  returns public.gestao_nivel language plpgsql stable security definer set search_path=public as $$
declare
  v_papel public.gestao_papel; v_quadro text; v_pasta uuid; v_espaco uuid;
  v_nivel public.gestao_nivel; v_teto_restr int;
begin
  v_papel := public.gestao_papel_de(p_email);
  if v_papel is null then return null; end if;                 -- não-membro → sem acesso
  if v_papel in ('owner','admin') then return 'full'; end if;  -- gestor → tudo

  if    p_recurso_tipo='task' then select id_quadro into v_quadro from public.gestao_tarefas where id_tarefa=p_recurso_id;
  elsif p_recurso_tipo='list' then v_quadro := p_recurso_id; end if;
  if v_quadro is not null then select id_espaco, id_pasta into v_espaco, v_pasta from public.gestao_quadros where id_quadro=v_quadro;
  elsif p_recurso_tipo='folder' then v_pasta := p_recurso_id::uuid; select id_espaco into v_espaco from public.gestao_pastas where id=v_pasta;
  elsif p_recurso_tipo='space' then v_espaco := p_recurso_id::uuid; end if;

  select a.nivel into v_nivel from public.gestao_acessos a
   where lower(a.usuario_email)=lower(p_email)
     and ( (a.recurso_tipo='task' and p_recurso_tipo='task' and a.recurso_id=p_recurso_id)
        or (a.recurso_tipo='list' and a.recurso_id=v_quadro)
        or (a.recurso_tipo='folder' and a.recurso_id=v_pasta::text)
        or (a.recurso_tipo='space' and a.recurso_id=v_espaco::text) )
   order by case a.recurso_tipo when 'task' then 4 when 'list' then 3 when 'folder' then 2 else 1 end desc limit 1;

  select min(public.gestao_nivel_ord(a.nivel)) into v_teto_restr from public.gestao_acessos a
   where lower(a.usuario_email)=lower(p_email) and a.restritivo
     and ( (a.recurso_tipo='task' and p_recurso_tipo='task' and a.recurso_id=p_recurso_id)
        or (a.recurso_tipo='list' and a.recurso_id=v_quadro)
        or (a.recurso_tipo='folder' and a.recurso_id=v_pasta::text)
        or (a.recurso_tipo='space' and a.recurso_id=v_espaco::text) );

  if v_nivel is null then
    -- sem grant explícito: só vê se a Lista for aberta (restrito=false). Espaço/Pasta = contêiner visível.
    if p_recurso_tipo in ('space','folder') or (v_quadro is not null and exists (select 1 from public.gestao_quadros where id_quadro=v_quadro and restrito=false)) then
      v_nivel := 'view';
    else
      return null;
    end if;
  end if;

  if v_teto_restr is not null and public.gestao_nivel_ord(v_nivel) > v_teto_restr then
    v_nivel := (array['view','comment','edit','full']::public.gestao_nivel[])[v_teto_restr];
  end if;
  return v_nivel;
end $$;

-- ── 6) RPC: conceder/revogar acesso a recurso (atômica + log + anti-escalação) ──
create or replace function public.gestao_alterar_acesso(
  p_alvo text, p_acao public.gestao_acao, p_recurso_tipo public.gestao_recurso, p_recurso_id text,
  p_nivel_novo public.gestao_nivel, p_motivo text
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_ator text := public.gestao_email(); v_papel public.gestao_papel; v_ator_nivel public.gestao_nivel; v_ant public.gestao_nivel; v_log uuid;
begin
  if length(trim(coalesce(p_motivo,''))) < 5 then raise exception 'motivo obrigatório (mínimo 5 caracteres)'; end if;
  v_papel := public.gestao_papel_de(v_ator);
  if v_papel is null then raise exception 'apenas membros da Gestão podem gerenciar acesso'; end if;
  if v_papel = 'membro' then
    v_ator_nivel := public.gestao_resolver_nivel(v_ator, p_recurso_tipo, p_recurso_id);
    if v_ator_nivel is null or public.gestao_nivel_ord(v_ator_nivel) < 3 then raise exception 'sem permissão para gerenciar acesso neste recurso'; end if;
    if p_nivel_novo = 'full' then raise exception 'nível full não é delegável'; end if;
    if public.gestao_nivel_ord(p_nivel_novo) > public.gestao_nivel_ord(v_ator_nivel) then raise exception 'não é possível conceder nível acima do próprio'; end if;
  end if;

  v_ant := (select nivel from public.gestao_acessos where lower(usuario_email)=lower(p_alvo) and recurso_tipo=p_recurso_tipo and recurso_id=p_recurso_id);
  if p_acao in ('removeu','revogou') then
    delete from public.gestao_acessos where lower(usuario_email)=lower(p_alvo) and recurso_tipo=p_recurso_tipo and recurso_id=p_recurso_id;
  else
    insert into public.gestao_acessos (id, usuario_email, recurso_tipo, recurso_id, nivel, concedido_por)
      values (gen_random_uuid(), p_alvo, p_recurso_tipo, p_recurso_id, p_nivel_novo, v_ator)
    on conflict (lower(usuario_email), recurso_tipo, recurso_id) do update set nivel=excluded.nivel, concedido_por=excluded.concedido_por;
  end if;
  insert into public.gestao_acesso_log (ator_email, alvo_email, acao, recurso_tipo, recurso_id, nivel_anterior, nivel_novo, motivo)
    values (v_ator, p_alvo, p_acao, p_recurso_tipo, p_recurso_id, v_ant, case when p_acao in ('removeu','revogou') then null else p_nivel_novo end, p_motivo)
    returning id into v_log;
  return v_log;
end $$;

-- ── 7) RPC: gerir o roster (adicionar/remover/mudar papel) — atômica + log ──
create or replace function public.gestao_definir_membro(p_alvo text, p_papel public.gestao_papel, p_ativo boolean, p_motivo text)
  returns uuid language plpgsql security definer set search_path=public as $$
declare v_ator text := public.gestao_email(); v_ator_papel public.gestao_papel; v_ant public.gestao_papel; v_log uuid;
begin
  if length(trim(coalesce(p_motivo,''))) < 5 then raise exception 'motivo obrigatório (mínimo 5 caracteres)'; end if;
  v_ator_papel := public.gestao_papel_de(v_ator);
  if v_ator_papel not in ('owner','admin') then raise exception 'apenas Owner/Admin gerenciam o roster'; end if;
  select papel into v_ant from public.gestao_membros where lower(usuario_email)=lower(p_alvo);
  if v_ator_papel = 'admin' and (p_papel = 'owner' or v_ant = 'owner') then
    raise exception 'admin não promove/altera owner';
  end if;
  insert into public.gestao_membros (usuario_email, papel, ativo, adicionado_por)
    values (p_alvo, p_papel, coalesce(p_ativo, true), v_ator)
  on conflict (lower(usuario_email)) do update set papel=excluded.papel, ativo=excluded.ativo;
  insert into public.gestao_acesso_log (ator_email, alvo_email, acao, motivo)
    values (v_ator, p_alvo,
            case when v_ant is null then 'convidou' when coalesce(p_ativo,true)=false then 'removeu' else 'alterou_papel' end,
            p_motivo)
    returning id into v_log;
  return v_log;
end $$;
