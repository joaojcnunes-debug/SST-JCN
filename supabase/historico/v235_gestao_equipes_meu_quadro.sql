-- v235 — GESTAO-EQUIPES-01 E1: equipes (acesso em lote), Meu Quadro por usuário e a visão
-- "Colaboradores" para supervisores. Briefing: .claude/briefings/GESTAO-EQUIPES-01.md (vault).
--
-- Decisões do operador (2026-09-21): supervisor vê só as equipes dele; supervisor tem `edit` no
-- Meu Quadro do colaborador; entrar numa equipe libera o módulo (roster `membro`); o atalho
-- perfil='Admin'→owner NÃO é tocado (SEC-GESTAO-03).
--
-- O que muda:
--   • gestao_equipes / gestao_equipe_membros (papel membro|supervisor). RLS: leitura por membro do
--     módulo; escrita só por RPC (revoke de DML — lição dos default privileges).
--   • gestao_acessos ganha id_equipe (principal alternativo: usuário OU equipe; check XOR).
--     O resolver passa a considerar os grants das equipes em que o e-mail é membro (maior nível na
--     mesma especificidade; restritivo respeitado como hoje). Policies de espaço/pasta idem.
--   • gestao_quadros.dono_email = Meu Quadro. Resolver: dono → full; supervisor de equipe do dono →
--     edit; gestor → full; demais → null (quadro pessoal NÃO herda grant de espaço/pasta).
--   • RPCs SECURITY DEFINER: gestao_equipe_salvar, gestao_equipe_excluir, gestao_equipe_definir_membro,
--     gestao_equipe_alterar_acesso, gestao_quadro_pessoal_de, gestao_meu_quadro, gestao_colaboradores_visiveis.
--
-- Aditiva/idempotente. Coluna/tabela nova → reload do PostgREST (docker restart). Rollback em
-- scripts/sql/v235_rollback_gestao_equipes_meu_quadro.sql.
--
-- NUMERAÇÃO: era v235; v231–v233 foram tomadas por outras frentes (medido no ato: presenca_auditoria_gerencia,
-- modulo_aberturas_log_leitura, cargos_canonicos). Depende do hotfix v234 (registrado como v231_sec_… ou v234_sec_…).
--
-- Exigências do revisor-seguranca (2026-09-21, 1ª rodada VETADA) atendidas aqui:
--   R1 guardas fail-closed p/ papel NULL (coalesce; depende do hotfix v234 em gestao_eh_gestor);
--   R2 trigger que impede authenticated/anon de gravar dono_email ou apagar Meu Quadro por DML;
--   R3 gestao_ve_tarefa ganha o ramo 4b: supervisor vê as tarefas do Meu Quadro que supervisiona
--      (restrito a quadros com dono_email — NÃO generaliza "edit vê tudo");
--   R4 Cliente do portal não entra em equipe; R5 guarda current_user='chabra_admin';
--   R6 sem INSERT redundante de status (o trigger v90 semeia 4); R7 gestao_equipe_membros_sel
--      restrita (gestor, o próprio, ou supervisor da equipe); R8 log "reativou" no roster.

-- JCN: dono das funcoes SECURITY DEFINER e 'postgres' (no self-host, 'chabra_admin').
do $$ begin if current_user <> 'postgres' then raise exception 'aplicar como postgres (dono das funções SECURITY DEFINER)'; end if; end $$;
-- JCN: sem public.schema_migrations (rastreador do self-host) — a pre-condicao
-- da v234 e conferida no proprio artefato.
do $$ begin
  if to_regprocedure('public.gestao_eh_gestor(text)') is null
     or position('v_ator_papel is null' in pg_get_functiondef('public.gestao_definir_membro(text,public.gestao_papel,boolean,text)'::regprocedure)) = 0 then
    raise exception 'aplique primeiro o hotfix v234 (guardas NULL)';
  end if;
end $$;

begin;

-- ── 1) Tabelas ──────────────────────────────────────────────────────────────────
create table if not exists public.gestao_equipes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  descricao   text,
  ativo       boolean not null default true,
  created_by  text,
  created_at  timestamptz not null default now()
);
create unique index if not exists uq_gestao_equipes_nome on public.gestao_equipes (lower(nome));

create table if not exists public.gestao_equipe_membros (
  id            uuid primary key default gen_random_uuid(),
  id_equipe     uuid not null references public.gestao_equipes(id) on delete cascade,
  usuario_email text not null,
  papel         text not null default 'membro' check (papel in ('membro','supervisor')),
  created_by    text,
  created_at    timestamptz not null default now()
);
create unique index if not exists uq_gestao_equipe_membros on public.gestao_equipe_membros (id_equipe, lower(usuario_email));
create index if not exists idx_gestao_equipe_membros_email on public.gestao_equipe_membros (lower(usuario_email));

alter table public.gestao_equipes enable row level security;
alter table public.gestao_equipe_membros enable row level security;
revoke all on public.gestao_equipes, public.gestao_equipe_membros from anon, authenticated, public;
grant select on public.gestao_equipes, public.gestao_equipe_membros to authenticated;
drop policy if exists gestao_equipes_sel on public.gestao_equipes;
create policy gestao_equipes_sel on public.gestao_equipes for select to authenticated
  using (public.gestao_papel_de(public.gestao_email()) is not null);
-- R7: gestor vê tudo; membro comum vê só as PRÓPRIAS linhas; supervisor vê as das equipes que supervisiona.
-- O helper é SECURITY DEFINER (dono da tabela ignora RLS): subquery direta na própria tabela dentro
-- da policy dá "infinite recursion detected in policy".
create or replace function public.gestao_equipes_supervisionadas(p_email text) returns setof uuid
  language sql stable security definer set search_path=public as $$
  select m.id_equipe from public.gestao_equipe_membros m
    join public.gestao_equipes e on e.id = m.id_equipe and e.ativo
   where lower(m.usuario_email) = lower(p_email) and m.papel = 'supervisor';
$$;
revoke execute on function public.gestao_equipes_supervisionadas(text) from public, anon;
grant execute on function public.gestao_equipes_supervisionadas(text) to authenticated, service_role;
drop policy if exists gestao_equipe_membros_sel on public.gestao_equipe_membros;
create policy gestao_equipe_membros_sel on public.gestao_equipe_membros for select to authenticated
  using (
    public.gestao_eh_gestor(public.gestao_email())
    or lower(usuario_email) = public.gestao_email()
    or id_equipe in (select public.gestao_equipes_supervisionadas(public.gestao_email()))
  );

-- ── 2) Grants por equipe ────────────────────────────────────────────────────────
alter table public.gestao_acessos alter column usuario_email drop not null;
alter table public.gestao_acessos add column if not exists id_equipe uuid references public.gestao_equipes(id) on delete cascade;
alter table public.gestao_acessos drop constraint if exists gestao_acessos_principal_chk;
alter table public.gestao_acessos add constraint gestao_acessos_principal_chk
  check ((usuario_email is not null) <> (id_equipe is not null));
create unique index if not exists uq_gestao_acessos_equipe
  on public.gestao_acessos (id_equipe, recurso_tipo, recurso_id) where id_equipe is not null;

-- ── 3) Meu Quadro ────────────────────────────────────────────────────────────────
alter table public.gestao_quadros add column if not exists dono_email text;
create unique index if not exists uq_gestao_quadros_dono on public.gestao_quadros (lower(dono_email)) where dono_email is not null;

-- R2: dono_email é coluna de AUTORIZAÇÃO. authenticated tem UPDATE/DELETE em gestao_quadros pela
-- policy `gestao_pode_editar_q` (v103) — um editor poderia sequestrar um quadro (set dono_email=ele)
-- ou apagar/desfazer o Meu Quadro de um colega. Só as RPCs SECURITY DEFINER (chabra_admin) mexem nisso.
create or replace function public.gestao_quadros_protege_dono() returns trigger
  language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' and new.dono_email is not null then raise exception 'Meu Quadro só nasce pelo RPC gestao_quadro_pessoal_de'; end if;
    if tg_op = 'UPDATE' and new.dono_email is distinct from old.dono_email then raise exception 'dono_email não pode ser alterado por DML'; end if;
    -- R-e: Meu Quadro não entra em espaço/pasta por DML (mudaria a classificação no rollback e a herança)
    if tg_op = 'UPDATE' and new.dono_email is not null and (new.id_espaco is distinct from old.id_espaco or new.id_pasta is distinct from old.id_pasta) then
      raise exception 'Meu Quadro não pertence a espaço/pasta'; end if;
    if tg_op = 'DELETE' and old.dono_email is not null then raise exception 'Meu Quadro não pode ser apagado por DML'; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists trg_gestao_quadros_protege_dono on public.gestao_quadros;
create trigger trg_gestao_quadros_protege_dono before insert or update or delete on public.gestao_quadros
  for each row execute function public.gestao_quadros_protege_dono();

-- ── 4) Helpers ──────────────────────────────────────────────────────────────────
create or replace function public.gestao_equipes_de(p_email text) returns setof uuid
  language sql stable security definer set search_path=public as $$
  select m.id_equipe from public.gestao_equipe_membros m
    join public.gestao_equipes e on e.id = m.id_equipe and e.ativo
   where lower(m.usuario_email) = lower(p_email);
$$;

-- p_sup supervisiona p_alvo se ambos estão numa mesma equipe ativa, p_sup como supervisor.
create or replace function public.gestao_supervisiona(p_sup text, p_alvo text) returns boolean
  language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.gestao_equipe_membros s
      join public.gestao_equipe_membros m on m.id_equipe = s.id_equipe
      join public.gestao_equipes e on e.id = s.id_equipe and e.ativo
     where lower(s.usuario_email) = lower(p_sup) and s.papel = 'supervisor'
       and lower(m.usuario_email) = lower(p_alvo));
$$;

-- ── 5) Resolver v3: equipes + Meu Quadro ────────────────────────────────────────
create or replace function public.gestao_resolver_nivel(p_email text, p_recurso_tipo gestao_recurso, p_recurso_id text)
returns gestao_nivel
language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  v_papel public.gestao_papel; v_quadro text; v_pasta uuid; v_espaco uuid; v_dono text;
  v_nivel public.gestao_nivel; v_teto_restr int;
begin
  v_papel := public.gestao_papel_de(p_email);
  if v_papel is null then return null; end if;
  if v_papel in ('owner','admin') then return 'full'; end if;

  if    p_recurso_tipo='task' then select id_quadro into v_quadro from public.gestao_tarefas where id_tarefa=p_recurso_id;
  elsif p_recurso_tipo='list' then v_quadro := p_recurso_id; end if;
  if v_quadro is not null then select id_espaco, id_pasta, dono_email into v_espaco, v_pasta, v_dono from public.gestao_quadros where id_quadro=v_quadro;
  elsif p_recurso_tipo='folder' then v_pasta := p_recurso_id::uuid; select id_espaco into v_espaco from public.gestao_pastas where id=v_pasta;
  elsif p_recurso_tipo='space' then v_espaco := p_recurso_id::uuid; end if;

  -- Meu Quadro: dono = full; supervisor da equipe do dono = edit; ninguém mais (não herda grant).
  if v_dono is not null then
    if lower(v_dono) = lower(p_email) then return 'full'; end if;
    if public.gestao_supervisiona(p_email, v_dono) then return 'edit'; end if;
    return null;
  end if;

  -- Grant mais específico (task > list > folder > space); na mesma especificidade, o maior nível.
  -- Principal = o próprio e-mail OU uma equipe ativa em que ele é membro.
  select a.nivel into v_nivel from public.gestao_acessos a
   where (lower(a.usuario_email)=lower(p_email) or a.id_equipe in (select public.gestao_equipes_de(p_email)))
     and ((a.recurso_tipo='task' and p_recurso_tipo='task' and a.recurso_id=p_recurso_id) or (a.recurso_tipo='list' and a.recurso_id=v_quadro)
       or (a.recurso_tipo='folder' and a.recurso_id=v_pasta::text) or (a.recurso_tipo='space' and a.recurso_id=v_espaco::text))
   order by case a.recurso_tipo when 'task' then 4 when 'list' then 3 when 'folder' then 2 else 1 end desc,
            public.gestao_nivel_ord(a.nivel) desc
   limit 1;

  select min(public.gestao_nivel_ord(a.nivel)) into v_teto_restr from public.gestao_acessos a
   where (lower(a.usuario_email)=lower(p_email) or a.id_equipe in (select public.gestao_equipes_de(p_email))) and a.restritivo
     and ((a.recurso_tipo='task' and p_recurso_tipo='task' and a.recurso_id=p_recurso_id) or (a.recurso_tipo='list' and a.recurso_id=v_quadro)
       or (a.recurso_tipo='folder' and a.recurso_id=v_pasta::text) or (a.recurso_tipo='space' and a.recurso_id=v_espaco::text));

  if v_nivel is null then return null; end if;
  if v_teto_restr is not null and public.gestao_nivel_ord(v_nivel) > v_teto_restr then
    v_nivel := (array['view','comment','edit','full']::public.gestao_nivel[])[v_teto_restr];
  end if;
  return v_nivel;
end $function$;

-- ── 5b) gestao_ve_tarefa: ramo 4b (R3) — corpo v200 verbatim + o ramo novo ─────────
create or replace function public.gestao_ve_tarefa(p_id_tarefa text)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_email text;
  v_papel public.gestao_papel;
begin
  -- 1) sem e-mail no JWT -> nao ve
  v_email := public.gestao_email();
  if v_email is null then
    return false;
  end if;

  -- 2) gestor global (owner/admin; perfil=Admin vira owner) ve TODAS
  v_papel := public.gestao_papel_de(v_email);
  if v_papel in ('owner','admin') then
    return true;
  end if;

  -- 3) nao-membro (papel nulo) nao ve
  if v_papel is null then
    return false;
  end if;

  -- 4) gestor DO quadro/espaco da tarefa: nivel herdado 'full' (>=4). Membro de quadro
  --    ABERTO resolve 'edit' (3) e NAO passa aqui — e exatamente o ponto do flip.
  if public.gestao_nivel_ord(
       public.gestao_resolver_nivel(v_email, 'task'::public.gestao_recurso, p_id_tarefa)
     ) >= 4 then
    return true;
  end if;

  -- 4b) v235: supervisor de equipe ve as tarefas do MEU QUADRO dos membros que supervisiona
  --     (restrito a quadros com dono_email; NAO generaliza "edit ve tudo").
  if exists (
       select 1 from public.gestao_tarefas t
       join public.gestao_quadros q on q.id_quadro = t.id_quadro
       where t.id_tarefa = p_id_tarefa
         and q.dono_email is not null
         and coalesce(public.gestao_supervisiona(v_email, q.dono_email), false)
     ) then
    return true;
  end if;

  -- 5) grant explicito NAO-restritivo na PROPRIA tarefa (view/comment/edit/full)
  if exists (
       select 1 from public.gestao_acessos a
       where a.recurso_tipo = 'task'::public.gestao_recurso
         and a.recurso_id = p_id_tarefa
         and coalesce(a.restritivo, false) = false
         and lower(a.usuario_email) = v_email
     ) then
    return true;
  end if;

  -- 6) vinculado (responsavel ou seguidor) a tarefa
  if exists (
       select 1 from public.gestao_tarefa_vinculados v
       where v.id_tarefa = p_id_tarefa
         and lower(v.usuario_email) = v_email
     ) then
    return true;
  end if;

  -- 7) criador da tarefa (created_by = e-mail do caller)
  if exists (
       select 1 from public.gestao_tarefas t
       where t.id_tarefa = p_id_tarefa
         and lower(t.created_by) = v_email
     ) then
    return true;
  end if;

  -- 7.5) responsavel de alguma subtarefa desta tarefa (alocar subtarefa -> ve a tarefa-mae)
  if exists (
       select 1 from public.gestao_subtarefas s
       where s.id_tarefa = p_id_tarefa
         and lower(s.responsavel_email) = v_email
     ) then
    return true;
  end if;

  -- 8) senao, nao ve
  return false;
end
$function$;

-- ── 6) Espaço/pasta: grants de equipe também abrem o contêiner ──────────────────
drop policy if exists gestao_espacos_sel on public.gestao_espacos;
create policy gestao_espacos_sel on public.gestao_espacos for select to authenticated
using (
  public.gestao_eh_gestor(public.gestao_email())
  or exists (select 1 from public.gestao_acessos a
       where a.recurso_tipo='space' and a.recurso_id=gestao_espacos.id::text
         and (lower(a.usuario_email)=public.gestao_email() or a.id_equipe in (select public.gestao_equipes_de(public.gestao_email()))))
  or exists (select 1 from public.gestao_quadros q
       where q.id_espaco=gestao_espacos.id and public.gestao_pode_ver(q.id_quadro))
);
drop policy if exists gestao_pastas_sel on public.gestao_pastas;
create policy gestao_pastas_sel on public.gestao_pastas for select to authenticated
using (
  public.gestao_eh_gestor(public.gestao_email())
  or exists (select 1 from public.gestao_acessos a
       where a.recurso_tipo='folder' and a.recurso_id=gestao_pastas.id::text
         and (lower(a.usuario_email)=public.gestao_email() or a.id_equipe in (select public.gestao_equipes_de(public.gestao_email()))))
  or exists (select 1 from public.gestao_acessos a
       where a.recurso_tipo='space' and a.recurso_id=gestao_pastas.id_espaco::text
         and (lower(a.usuario_email)=public.gestao_email() or a.id_equipe in (select public.gestao_equipes_de(public.gestao_email()))))
  or exists (select 1 from public.gestao_quadros q
       where q.id_pasta=gestao_pastas.id and public.gestao_pode_ver(q.id_quadro))
);

-- ── 7) RPCs ─────────────────────────────────────────────────────────────────────
-- Equipe: criar/renomear/ativar (gestor). Devolve o id.
create or replace function public.gestao_equipe_salvar(p_id uuid, p_nome text, p_descricao text, p_ativo boolean)
  returns uuid language plpgsql security definer set search_path=public as $$
declare v_ator text := public.gestao_email(); v_id uuid;
begin
  if not coalesce(public.gestao_eh_gestor(v_ator), false) then raise exception 'apenas Owner/Admin gerenciam equipes'; end if;
  if length(trim(coalesce(p_nome,''))) < 2 then raise exception 'nome da equipe obrigatório'; end if;
  if p_id is null then
    insert into public.gestao_equipes (nome, descricao, ativo, created_by) values (trim(p_nome), p_descricao, coalesce(p_ativo,true), v_ator) returning id into v_id;
  else
    -- R-b: desativar a equipe suspende os grants dela (helpers filtram e.ativo) — fica no log
    if coalesce(p_ativo,true) = false and exists (select 1 from public.gestao_equipes where id=p_id and ativo) then
      insert into public.gestao_acesso_log (ator_email, alvo_email, acao, recurso_tipo, recurso_id, nivel_anterior, nivel_novo, motivo)
        select v_ator, 'equipe:'||e.nome, 'revogou'::public.gestao_acao, a.recurso_tipo, a.recurso_id, a.nivel, null, 'equipe desativada (grants suspensos)'
          from public.gestao_acessos a join public.gestao_equipes e on e.id=a.id_equipe where a.id_equipe=p_id;
    end if;
    update public.gestao_equipes set nome=trim(p_nome), descricao=p_descricao, ativo=coalesce(p_ativo,true) where id=p_id returning id into v_id;
    if v_id is null then raise exception 'equipe não encontrada'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.gestao_equipe_excluir(p_id uuid)
  returns void language plpgsql security definer set search_path=public as $$
begin
  if not coalesce(public.gestao_eh_gestor(public.gestao_email()), false) then raise exception 'apenas Owner/Admin gerenciam equipes'; end if;
  -- R-b: a cascata revoga todos os grants da equipe — cada um vira linha no log (append-only, v116)
  insert into public.gestao_acesso_log (ator_email, alvo_email, acao, recurso_tipo, recurso_id, nivel_anterior, nivel_novo, motivo)
    select public.gestao_email(), 'equipe:'||e.nome, 'revogou'::public.gestao_acao, a.recurso_tipo, a.recurso_id, a.nivel, null, 'equipe excluída'
      from public.gestao_acessos a join public.gestao_equipes e on e.id=a.id_equipe where a.id_equipe=p_id;
  delete from public.gestao_equipes where id=p_id;  -- cascata: membros + grants da equipe
end $$;

-- Membro da equipe (gestor). p_ativo=false remove. Entrar numa equipe LIBERA o módulo (roster membro)
-- — sem rebaixar quem já é owner/admin. Log em gestao_acesso_log (alvo = e-mail; recurso = null).
create or replace function public.gestao_equipe_definir_membro(p_id_equipe uuid, p_email text, p_papel text, p_ativo boolean)
  returns void language plpgsql security definer set search_path=public as $$
declare v_ator text := public.gestao_email(); v_nome text; v_existia boolean; v_roster_inativo boolean;
begin
  if not coalesce(public.gestao_eh_gestor(v_ator), false) then raise exception 'apenas Owner/Admin gerenciam equipes'; end if;
  select nome into v_nome from public.gestao_equipes where id=p_id_equipe;
  if v_nome is null then raise exception 'equipe não encontrada'; end if;
  if coalesce(p_papel,'membro') not in ('membro','supervisor') then raise exception 'papel inválido'; end if;
  -- R4: só usuário interno ATIVO (Cliente do portal nunca entra em equipe nem no roster)
  if not exists (select 1 from public.usuarios u where lower(u.email)=lower(p_email) and coalesce(u.ativo_sistema,true) and u.perfil <> 'Cliente') then
    raise exception 'usuário % não existe, está inativo ou é Cliente', p_email;
  end if;
  v_existia := exists (select 1 from public.gestao_equipe_membros where id_equipe=p_id_equipe and lower(usuario_email)=lower(p_email));
  if coalesce(p_ativo,true) then
    insert into public.gestao_equipe_membros (id_equipe, usuario_email, papel, created_by)
      values (p_id_equipe, lower(p_email), coalesce(p_papel,'membro'), v_ator)
    on conflict (id_equipe, lower(usuario_email)) do update set papel=excluded.papel;
    -- libera o módulo: só quem ainda não está no roster (nunca rebaixa owner/admin). Decisão 3 do
    -- operador: reativa um `membro` desativado (fica no log como "reativou").
    -- R-g: owner/admin DESATIVADO no roster não é reativado aqui (seria promoção silenciosa) — erro claro.
    if exists (select 1 from public.gestao_membros where lower(usuario_email)=lower(p_email) and papel in ('owner','admin') and not ativo) then
      raise exception 'usuário % é owner/admin desativado no roster: reative-o em "Membros e acessos" antes', p_email;
    end if;
    v_roster_inativo := exists (select 1 from public.gestao_membros where lower(usuario_email)=lower(p_email) and papel='membro' and not ativo);
    insert into public.gestao_membros (usuario_email, papel, ativo, adicionado_por)
      values (lower(p_email), 'membro', true, v_ator)
    on conflict (lower(usuario_email)) do update set ativo = true
      where public.gestao_membros.papel = 'membro';
    insert into public.gestao_acesso_log (ator_email, alvo_email, acao, motivo)
      values (v_ator, lower(p_email), (case when v_existia then 'alterou_papel' else 'convidou' end)::public.gestao_acao,  -- cast: lição v221
              'equipe "'||v_nome||'" ('||coalesce(p_papel,'membro')||')'||case when v_roster_inativo then ' — reativou no roster' else '' end);
  else
    delete from public.gestao_equipe_membros where id_equipe=p_id_equipe and lower(usuario_email)=lower(p_email);
    insert into public.gestao_acesso_log (ator_email, alvo_email, acao, motivo)
      values (v_ator, lower(p_email), 'removeu', 'saiu da equipe "'||v_nome||'"');
  end if;
end $$;

-- Grant de quadro/espaço/pasta para a EQUIPE (gestor). p_nivel null = revoga. Log com alvo 'equipe:<nome>'.
create or replace function public.gestao_equipe_alterar_acesso(p_id_equipe uuid, p_recurso_tipo public.gestao_recurso, p_recurso_id text, p_nivel public.gestao_nivel, p_motivo text)
  returns void language plpgsql security definer set search_path=public as $$
declare v_ator text := public.gestao_email(); v_nome text; v_ant public.gestao_nivel;
begin
  if not coalesce(public.gestao_eh_gestor(v_ator), false) then raise exception 'apenas Owner/Admin gerenciam equipes'; end if;
  if length(trim(coalesce(p_motivo,''))) < 5 then raise exception 'motivo obrigatório (mínimo 5 caracteres)'; end if;
  select nome into v_nome from public.gestao_equipes where id=p_id_equipe;
  if v_nome is null then raise exception 'equipe não encontrada'; end if;
  select nivel into v_ant from public.gestao_acessos where id_equipe=p_id_equipe and recurso_tipo=p_recurso_tipo and recurso_id=p_recurso_id;
  if p_nivel is null then
    delete from public.gestao_acessos where id_equipe=p_id_equipe and recurso_tipo=p_recurso_tipo and recurso_id=p_recurso_id;
  else
    insert into public.gestao_acessos (id, id_equipe, usuario_email, papel, id_quadro, recurso_tipo, recurso_id, nivel, concedido_por)
      values (gen_random_uuid(), p_id_equipe, null, case when p_nivel in ('edit','full') then 'editor' else 'viewer' end,
              case when p_recurso_tipo='list' then p_recurso_id else null end, p_recurso_tipo, p_recurso_id, p_nivel, v_ator)
    on conflict (id_equipe, recurso_tipo, recurso_id) where id_equipe is not null
      do update set nivel=excluded.nivel, papel=excluded.papel, concedido_por=excluded.concedido_por;
  end if;
  insert into public.gestao_acesso_log (ator_email, alvo_email, acao, recurso_tipo, recurso_id, nivel_anterior, nivel_novo, motivo)
    values (v_ator, 'equipe:'||v_nome, (case when p_nivel is null then 'revogou' else 'concedeu' end)::public.gestao_acao, p_recurso_tipo, p_recurso_id, v_ant, p_nivel, p_motivo);
end $$;

-- Meu Quadro de p_email (cria sob demanda). Quem pode: o próprio, gestor, ou supervisor da equipe dele.
create or replace function public.gestao_quadro_pessoal_de(p_email text)
  returns text language plpgsql security definer set search_path=public as $$
declare v_ator text := public.gestao_email(); v_id text; v_nome text;
begin
  if v_ator is null then raise exception 'sem sessão'; end if;
  -- R1: fail-closed — NULL em qualquer ramo (não-membro) barra.
  if not coalesce((lower(v_ator)=lower(p_email) or coalesce(public.gestao_eh_gestor(v_ator), false) or coalesce(public.gestao_supervisiona(v_ator, p_email), false)), false) then
    raise exception 'sem permissão para abrir o Meu Quadro de %', p_email;
  end if;
  if public.gestao_papel_de(p_email) is null then raise exception 'usuário % não é membro da Gestão', p_email; end if;
  select id_quadro into v_id from public.gestao_quadros where lower(dono_email)=lower(p_email);
  if v_id is not null then return v_id; end if;
  select nome into v_nome from public.usuarios where lower(email)=lower(p_email);
  v_id := 'QDR-ME' || upper(substr(md5(lower(p_email)), 1, 6));
  -- R6: o trigger v90 (trg_gestao_seed_status) semeia os 4 status padrão no INSERT do quadro.
  insert into public.gestao_quadros (id_quadro, nome, descricao, created_by, dono_email, ordem, restrito)
    values (v_id, 'Meu Quadro — '||coalesce(v_nome, p_email), 'Quadro pessoal (criado automaticamente)', v_ator, lower(p_email), 999, false)
  on conflict (id_quadro) do nothing;
  -- N1 (revisor, 2ª rodada): o id é determinístico e ids nascem no cliente — alguém com caller_pode_editar()
  -- poderia ocupar o id antes ("squat") e a vítima receberia um quadro que não é dela. Só devolve o que
  -- realmente tem dono_email = p_email; senão, falha alto.
  select id_quadro into v_id from public.gestao_quadros where lower(dono_email)=lower(p_email);
  if v_id is null then raise exception 'id do Meu Quadro de % já está ocupado por outro quadro — avise a TI', p_email; end if;
  return v_id;
end $$;

create or replace function public.gestao_meu_quadro() returns text
  language sql security definer set search_path=public as $$ select public.gestao_quadro_pessoal_de(public.gestao_email()); $$;

-- Colaboradores visíveis: gestor = todos os membros do módulo; supervisor = membros das equipes que supervisiona.
create or replace function public.gestao_colaboradores_visiveis()
  returns table (usuario_email text, nome text, id_quadro text, equipes text[], papel_gestao text)
  language sql stable security definer set search_path=public as $$
  with eu as (select public.gestao_email() as email),
  base as (
    select lower(u.email) as email, u.nome
      from public.usuarios u, eu
     where coalesce(u.ativo_sistema,true) and u.perfil <> 'Cliente' and lower(u.email) <> lower(eu.email)
       and public.gestao_papel_de(u.email) is not null
       and (public.gestao_eh_gestor(eu.email) or public.gestao_supervisiona(eu.email, u.email))
  )
  select b.email, b.nome, q.id_quadro,
         coalesce((select array_agg(e.nome order by e.nome) from public.gestao_equipe_membros m join public.gestao_equipes e on e.id=m.id_equipe and e.ativo where lower(m.usuario_email)=b.email), '{}'::text[]),
         public.gestao_papel_de(b.email)::text
    from base b
    left join public.gestao_quadros q on lower(q.dono_email)=b.email
   order by b.nome;
$$;

-- anon não executa nada disto (default privileges do painel_sst dão EXECUTE a PUBLIC — lição ACCESS-SEATS F0).
revoke execute on function public.gestao_equipes_de(text), public.gestao_supervisiona(text,text),
  public.gestao_equipe_salvar(uuid,text,text,boolean), public.gestao_equipe_excluir(uuid),
  public.gestao_equipe_definir_membro(uuid,text,text,boolean), public.gestao_equipe_alterar_acesso(uuid,public.gestao_recurso,text,public.gestao_nivel,text),
  public.gestao_quadro_pessoal_de(text), public.gestao_meu_quadro(), public.gestao_colaboradores_visiveis()
  from public, anon;
-- R-a: gestao_supervisiona só é chamada por funções SECURITY DEFINER (chabra_admin) — não vira /rpc.
revoke execute on function public.gestao_supervisiona(text,text) from authenticated;
grant execute on function public.gestao_supervisiona(text,text) to service_role;
grant execute on function public.gestao_equipes_de(text),
  public.gestao_equipe_salvar(uuid,text,text,boolean), public.gestao_equipe_excluir(uuid),
  public.gestao_equipe_definir_membro(uuid,text,text,boolean), public.gestao_equipe_alterar_acesso(uuid,public.gestao_recurso,text,public.gestao_nivel,text),
  public.gestao_quadro_pessoal_de(text), public.gestao_meu_quadro(), public.gestao_colaboradores_visiveis()
  to authenticated, service_role;

commit;
