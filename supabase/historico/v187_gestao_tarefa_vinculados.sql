-- v187 — GESTAO-KANBAN-01-F1.2: nasce o vinculo multiplo por tarefa.
--
-- Cria gestao_tarefa_vinculados (responsavel|seguidor por e-mail), faz o backfill do
-- responsavel-texto legado (casando usuarios.nome, case-insensitive) e instala o
-- trigger-espelho server-side que mantem gestao_tarefas.responsavel = usuarios.NOME do
-- vinculo tipo='responsavel' (o NOME, nunca o e-mail — o `notificar` da v120:54 e o feed
-- ICS resolvem e-mail por usuarios.nome=responsavel). Direcao unica: vinculo -> responsavel.
--
-- Puramente aditiva: o front antigo (em producao) continua escrevendo `responsavel` direto e
-- NAO toca esta tabela; o espelho so dispara quando uma linha de vinculo muda, entao a
-- migration aplicada sozinha nao briga com o front antigo (Ordem de aplicacao §1 da rubrica).
--
-- Escrita (Decisao 5a): SEM RPC novo. `revoke all` de authenticated/anon/public + grants
-- explicitos (SELECT/INSERT/DELETE, sem UPDATE) + RLS com policies gated pelo quadro-pai
-- (gestao_pode_ver p/ ler, gestao_pode_editar_q p/ escrever). Nenhuma policy using(true).
--
-- Idempotente: aplica 2x com exit 0 (create ... if not exists, guardas convergentes).
-- begin;...commit; PROPRIO — NAO aplicar com psql -1.

begin;

-- (0) Guardas — falha fechada em vez de aplicar as cegas (padrao v186). ─────────
do $$
begin
  if to_regclass('public.gestao_tarefas') is null then
    raise exception 'v187: public.gestao_tarefas nao existe — abortado';
  end if;
  if to_regprocedure('public.gestao_pode_ver(text)') is null then
    raise exception 'v187: gestao_pode_ver(text) ausente — a RLS de SELECT dependeria dela; abortado';
  end if;
  if to_regprocedure('public.gestao_pode_editar_q(text)') is null then
    raise exception 'v187: gestao_pode_editar_q(text) ausente — a RLS de escrita dependeria dela; abortado';
  end if;
end $$;

-- (1) Tabela ────────────────────────────────────────────────────────────────────
-- id_tarefa e TEXT: a PK de gestao_tarefas e id_tarefa text (nao `id`).
-- usuario_email e sempre armazenado em minusculas (CHECK abaixo), de modo que a
-- UNIQUE por colunas planas equivale a unicidade por lower(usuario_email) e ainda
-- aparece em pg_constraint (contype='u') — UNIQUE de expressao so existiria como indice.
create table if not exists public.gestao_tarefa_vinculados (
  id uuid primary key default gen_random_uuid(),
  id_tarefa text not null references public.gestao_tarefas(id_tarefa) on delete cascade,
  usuario_email text not null check (usuario_email = lower(usuario_email)),
  tipo text not null check (tipo in ('responsavel','seguidor')),
  origem text not null default 'app',
  created_at timestamptz not null default now(),
  constraint gestao_tarefa_vinculados_uq unique (id_tarefa, usuario_email, tipo)
);

create index if not exists idx_gestao_tarefa_vinc_tarefa
  on public.gestao_tarefa_vinculados (id_tarefa);
create index if not exists idx_gestao_tarefa_vinc_email
  on public.gestao_tarefa_vinculados (lower(usuario_email));

comment on table public.gestao_tarefa_vinculados is
  'Vinculos multiplos por tarefa (responsavel|seguidor por e-mail). Escrita SO por '
  'authenticated com gestao_pode_editar_q(quadro-pai) via RLS (v187, GESTAO-KANBAN-01-F1.2). '
  'gestao_tarefas.responsavel e espelhado do vinculo tipo=responsavel pelo trigger.';

-- (2) Fecha a armadilha de default privileges (toda tabela nova nasce com DML aberto
--     a authenticated — raiz de SEC-GESTAO-01). Revoga tudo e reconcede so o necessario.
revoke all on public.gestao_tarefa_vinculados from authenticated;
revoke all on public.gestao_tarefa_vinculados from anon;
revoke all on public.gestao_tarefa_vinculados from public;
grant select, insert, delete on public.gestao_tarefa_vinculados to authenticated;
-- (sem UPDATE: vinculo e insert/delete apenas; reconciliacao = delete+insert no cliente)

-- (3) RLS ligada + policies gated pelo quadro-pai (padrao das satelites da v103). ───
alter table public.gestao_tarefa_vinculados enable row level security;

drop policy if exists gestao_tarefa_vinc_sel on public.gestao_tarefa_vinculados;
create policy gestao_tarefa_vinc_sel on public.gestao_tarefa_vinculados
  for select to authenticated
  using (public.gestao_pode_ver(
    (select t.id_quadro from public.gestao_tarefas t where t.id_tarefa = gestao_tarefa_vinculados.id_tarefa)
  ));

drop policy if exists gestao_tarefa_vinc_ins on public.gestao_tarefa_vinculados;
create policy gestao_tarefa_vinc_ins on public.gestao_tarefa_vinculados
  for insert to authenticated
  with check (public.gestao_pode_editar_q(
    (select t.id_quadro from public.gestao_tarefas t where t.id_tarefa = gestao_tarefa_vinculados.id_tarefa)
  ));

drop policy if exists gestao_tarefa_vinc_del on public.gestao_tarefa_vinculados;
create policy gestao_tarefa_vinc_del on public.gestao_tarefa_vinculados
  for delete to authenticated
  using (public.gestao_pode_editar_q(
    (select t.id_quadro from public.gestao_tarefas t where t.id_tarefa = gestao_tarefa_vinculados.id_tarefa)
  ));

-- (4) Trigger-espelho server-side (padrao v118/v120, guarda de recursao por GUC). ──
-- Direcao unica: quando um vinculo tipo='responsavel' muda, reflete o NOME do usuario
-- casado em gestao_tarefas.responsavel. Se nao restar vinculo responsavel, zera responsavel.
-- NUNCA grava o e-mail — o notificar da v120 (select email from usuarios where nome=responsavel)
-- e o ICS dependem do NOME. Nao ha direcao reversa (responsavel -> vinculo).
create or replace function public.gestao_vinculo_espelho_trg() returns trigger
  language plpgsql security definer set search_path=public as $fn$
declare v_id text; v_nome text;
begin
  -- guarda de recursao: se ja estamos dentro de um sync, nao reentra.
  if coalesce(current_setting('gestao.in_vinculo_sync', true), '') = 'on' then
    return null;
  end if;
  -- so reconcilia quando o papel envolvido e 'responsavel'.
  if coalesce(new.tipo, old.tipo) is distinct from 'responsavel' then
    return null;
  end if;
  v_id := coalesce(new.id_tarefa, old.id_tarefa);

  select u.nome into v_nome
    from public.gestao_tarefa_vinculados v
    join public.usuarios u on lower(u.email) = v.usuario_email
   where v.id_tarefa = v_id and v.tipo = 'responsavel'
   order by v.created_at desc
   limit 1;

  perform set_config('gestao.in_vinculo_sync', 'on', true);   -- is_local: so nesta transacao
  update public.gestao_tarefas
     set responsavel = v_nome, updated_at = now()
   where id_tarefa = v_id and responsavel is distinct from v_nome;
  perform set_config('gestao.in_vinculo_sync', 'off', true);

  return null;
end $fn$;

drop trigger if exists trg_gestao_vinculo_espelho on public.gestao_tarefa_vinculados;
create trigger trg_gestao_vinculo_espelho
  after insert or update or delete on public.gestao_tarefa_vinculados
  for each row execute function public.gestao_vinculo_espelho_trg();

-- (5) Backfill idempotente — 1 linha tipo='responsavel' por tarefa cujo responsavel
--     casa usuarios.nome (case-insensitive). e-mail gravado em minusculas (CHECK).
insert into public.gestao_tarefa_vinculados (id_tarefa, usuario_email, tipo, origem)
select t.id_tarefa, lower(btrim(u.email)), 'responsavel', 'backfill:v187'
  from public.gestao_tarefas t
  join public.usuarios u on lower(btrim(u.nome)) = lower(btrim(t.responsavel))
 where t.responsavel is not null and btrim(t.responsavel) <> ''
on conflict (id_tarefa, usuario_email, tipo) do nothing;

-- (6) Relatorio obrigatorio de nao-casados (revisado pelo operador no gate C6). ────
do $$
declare r record; v_orfaos int := 0;
begin
  for r in
    select distinct btrim(t.responsavel) as responsavel
      from public.gestao_tarefas t
     where t.responsavel is not null and btrim(t.responsavel) <> ''
       and not exists (
         select 1 from public.usuarios u
          where lower(btrim(u.nome)) = lower(btrim(t.responsavel))
       )
  loop
    raise notice 'v187 backfill: responsavel SEM match em usuarios.nome: "%"', r.responsavel;
    v_orfaos := v_orfaos + 1;
  end loop;
  raise notice 'v187 backfill: % responsavel(is) nao-casado(s); % vinculo(s) responsavel no total',
    v_orfaos, (select count(*) from public.gestao_tarefa_vinculados where tipo = 'responsavel');
end $$;

commit;
