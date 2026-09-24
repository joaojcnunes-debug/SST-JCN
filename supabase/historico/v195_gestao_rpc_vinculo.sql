-- v195 — GESTAO-KANBAN-01-F1.3-C: RPC logado de vinculo (fecha R1 + R2).
--
-- Achado F1.2 (wiki/painel-sst/gestao-chabra.md): sob a visibilidade por-tarefa que B
-- instala, escrever um vinculo passa a conceder visao. Hoje a escrita de
-- gestao_tarefa_vinculados e DML direto gated so pelo quadro-pai (gestao_pode_editar_q),
-- que em quadro ABERTO da edit a qualquer membro -> qualquer membro vincula qualquer
-- e-mail (R1: auto-concessao) e sem trilha de autoria (R2).
--
-- Correcao (aditiva): a escrita passa a ser SO pelo RPC logado. Comum vincula so a si;
-- gestor (owner/admin OU nivel full na tarefa) vincula qualquer um; toda mutacao grava
-- linha em gestao_vinculo_log (tabela dedicada, nasce FECHADA). O revoke do DML direto
-- de authenticated vem na v196 SEPARADA (aplicada so DEPOIS do front no ar).
--
-- Espelha gestao_alterar_acesso (v118): SECURITY DEFINER, dono chabra_admin,
-- search_path=public, EXECUTE so a authenticated (NAO a public/anon — licao SEC-GESTAO-02).
-- A escrita definer mantem o trigger-espelho v187 disparando (responsavel = usuarios.NOME).
--
-- Idempotente: aplica 2x com exit 0 (create if not exists, create or replace, guardas
-- convergentes). begin;...commit; PROPRIO — NAO aplicar com psql -1.

begin;

-- (0) Guardas — falha fechada em vez de aplicar as cegas (padrao v186/v187). ──────
do $$
declare v_owner name;
begin
  if to_regclass('public.gestao_tarefas') is null then
    raise exception 'v195: public.gestao_tarefas nao existe — abortado';
  end if;
  if to_regclass('public.gestao_tarefa_vinculados') is null then
    raise exception 'v195: public.gestao_tarefa_vinculados (v187) ausente — abortado';
  end if;
  if to_regprocedure('public.gestao_email()') is null then
    raise exception 'v195: gestao_email() ausente — abortado';
  end if;
  if to_regprocedure('public.gestao_papel_de(text)') is null then
    raise exception 'v195: gestao_papel_de(text) ausente — abortado';
  end if;
  if to_regprocedure('public.gestao_resolver_nivel(text,public.gestao_recurso,text)') is null then
    raise exception 'v195: gestao_resolver_nivel ausente — abortado';
  end if;
  if to_regprocedure('public.gestao_pode_editar_q(text)') is null then
    raise exception 'v195: gestao_pode_editar_q(text) ausente — abortado';
  end if;
  if to_regprocedure('public.gestao_eh_gestor(text)') is null then
    raise exception 'v195: gestao_eh_gestor(text) ausente — abortado';
  end if;
  -- o RPC SECURITY DEFINER precisa ser dono da tabela-alvo p/ escapar da RLS.
  select pg_get_userbyid(c.relowner) into v_owner
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname='public' and c.relname='gestao_tarefa_vinculados';
  if v_owner is distinct from 'chabra_admin' then
    raise exception 'v195: dono de gestao_tarefa_vinculados = % (esperado chabra_admin) — abortado', v_owner;
  end if;
end $$;

-- (1) Tabela de log dedicada — nasce FECHADA (Decisao 1 do operador). ────────────
-- Modela `tipo` (responsavel|seguidor) naturalmente e sem churn do enum gestao_acao.
-- Escrita SO dentro das RPCs (SECURITY DEFINER, dono chabra_admin = dono da tabela,
-- bypassa RLS e grants). authenticated so LE, e so linhas do quadro-pai que gerencia.
create table if not exists public.gestao_vinculo_log (
  id uuid primary key default gen_random_uuid(),
  ator_email text not null,
  alvo_email text not null,
  acao text not null check (acao in ('vinculou','desvinculou')),
  tipo text not null check (tipo in ('responsavel','seguidor')),
  id_tarefa text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_gestao_vinculo_log_tarefa
  on public.gestao_vinculo_log (id_tarefa);

comment on table public.gestao_vinculo_log is
  'Trilha de autoria dos vinculos por tarefa (R2). Escrita SO dentro de '
  'gestao_vincular/gestao_desvincular (SECURITY DEFINER, dono chabra_admin). '
  'authenticated nao tem DML direto; SELECT gated por gestor do quadro-pai OU admin '
  '(v195, GESTAO-KANBAN-01-F1.3-C).';

-- Fecha a armadilha de default privileges (toda tabela nova nasce com DML aberto a
-- authenticated — raiz de SEC-GESTAO-01). Revoga tudo, reconcede so SELECT.
revoke all on public.gestao_vinculo_log from authenticated;
revoke all on public.gestao_vinculo_log from anon;
revoke all on public.gestao_vinculo_log from public;
grant select on public.gestao_vinculo_log to authenticated;

alter table public.gestao_vinculo_log enable row level security;

-- SELECT: admin global (gestao_eh_gestor) OU gestor do quadro-pai (pode editar a lista).
-- Espelha o gate de gestao_acesso_log_sel (v116), estendido ao quadro-pai da tarefa.
drop policy if exists gestao_vinculo_log_sel on public.gestao_vinculo_log;
create policy gestao_vinculo_log_sel on public.gestao_vinculo_log
  for select to authenticated
  using (
    public.gestao_eh_gestor(public.gestao_email())
    or public.gestao_pode_editar_q(
         (select t.id_quadro from public.gestao_tarefas t where t.id_tarefa = gestao_vinculo_log.id_tarefa)
       )
  );
-- Sem policy de INSERT/UPDATE/DELETE: o log nasce so dentro das RPCs (definer). Append-only.

-- (2) RPC gestao_vincular — comum so a si; gestor qualquer um; loga sempre. ────────
create or replace function public.gestao_vincular(p_id_tarefa text, p_email text, p_tipo text)
  returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_ator text := public.gestao_email();
  v_alvo text := lower(btrim(coalesce(p_email, '')));
  v_quadro text;
  v_eh_gestor boolean;
  v_log uuid;
begin
  if v_ator is null then raise exception 'nao autenticado'; end if;
  if v_alvo = '' then raise exception 'e-mail do vinculo obrigatorio'; end if;
  if p_tipo not in ('responsavel','seguidor') then raise exception 'tipo invalido: %', p_tipo; end if;

  v_quadro := (select id_quadro from public.gestao_tarefas where id_tarefa = p_id_tarefa);
  if v_quadro is null then raise exception 'tarefa inexistente: %', p_id_tarefa; end if;

  -- Piso: sem edicao no quadro-pai, ninguem vincula (mesma pre-condicao de hoje).
  if not public.gestao_pode_editar_q(v_quadro) then
    raise exception 'sem edicao neste quadro';
  end if;

  -- Gestor = owner/admin OU nivel full na tarefa (Decisao 2). Comum so a si.
  v_eh_gestor := public.gestao_papel_de(v_ator) in ('owner','admin')
              or public.gestao_resolver_nivel(v_ator, 'task', p_id_tarefa) = 'full';
  if not v_eh_gestor and v_alvo <> lower(v_ator) then
    raise exception 'voce so pode vincular a si mesmo';
  end if;

  -- Escrita (bypassa RLS como definer). Trigger-espelho v187 reflete responsavel=NOME.
  insert into public.gestao_tarefa_vinculados (id_tarefa, usuario_email, tipo, origem)
    values (p_id_tarefa, v_alvo, p_tipo, 'app')
  on conflict (id_tarefa, usuario_email, tipo) do nothing;

  insert into public.gestao_vinculo_log (ator_email, alvo_email, acao, tipo, id_tarefa)
    values (v_ator, v_alvo, 'vinculou', p_tipo, p_id_tarefa)
    returning id into v_log;

  return v_log;
end $$;

-- (3) RPC gestao_desvincular — simetrico (Decisao 3). p_tipo p/ delta e log fieis. ─
create or replace function public.gestao_desvincular(p_id_tarefa text, p_email text, p_tipo text)
  returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_ator text := public.gestao_email();
  v_alvo text := lower(btrim(coalesce(p_email, '')));
  v_quadro text;
  v_eh_gestor boolean;
  v_log uuid;
begin
  if v_ator is null then raise exception 'nao autenticado'; end if;
  if v_alvo = '' then raise exception 'e-mail do vinculo obrigatorio'; end if;
  if p_tipo not in ('responsavel','seguidor') then raise exception 'tipo invalido: %', p_tipo; end if;

  v_quadro := (select id_quadro from public.gestao_tarefas where id_tarefa = p_id_tarefa);
  if v_quadro is null then raise exception 'tarefa inexistente: %', p_id_tarefa; end if;

  if not public.gestao_pode_editar_q(v_quadro) then
    raise exception 'sem edicao neste quadro';
  end if;

  v_eh_gestor := public.gestao_papel_de(v_ator) in ('owner','admin')
              or public.gestao_resolver_nivel(v_ator, 'task', p_id_tarefa) = 'full';
  if not v_eh_gestor and v_alvo <> lower(v_ator) then
    raise exception 'voce so pode desvincular a si mesmo';
  end if;

  delete from public.gestao_tarefa_vinculados
   where id_tarefa = p_id_tarefa and usuario_email = v_alvo and tipo = p_tipo;

  insert into public.gestao_vinculo_log (ator_email, alvo_email, acao, tipo, id_tarefa)
    values (v_ator, v_alvo, 'desvinculou', p_tipo, p_id_tarefa)
    returning id into v_log;

  return v_log;
end $$;

-- (4) Dono + EXECUTE: so authenticated (NAO public/anon — licao SEC-GESTAO-02). ────
alter function public.gestao_vincular(text,text,text) owner to chabra_admin;
alter function public.gestao_desvincular(text,text,text) owner to chabra_admin;

revoke execute on function public.gestao_vincular(text,text,text) from public;
revoke execute on function public.gestao_vincular(text,text,text) from anon;
revoke execute on function public.gestao_desvincular(text,text,text) from public;
revoke execute on function public.gestao_desvincular(text,text,text) from anon;
grant execute on function public.gestao_vincular(text,text,text) to authenticated;
grant execute on function public.gestao_desvincular(text,text,text) to authenticated;

commit;
