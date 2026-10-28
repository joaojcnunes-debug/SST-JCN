-- v304 — Gestão: níveis de acesso claros (28/10/2026)
--
-- O nível de acesso tinha dois significados misturados. Na tela, "Visualizador total" era o
-- `full` — o nível MÁXIMO (vê todas as tarefas E edita/apaga todas) — e "Pode editar" (`edit`)
-- via MENOS que ele (só as tarefas em que a pessoa está). Não existia "vê todas, só lê".
--
-- Agora são dois eixos:
--   o que FAZ   ver (1) · comentar (2) · editar (3)          → gestao_nivel_ord
--   o que VÊ    só as tarefas em que está · todas do quadro   → gestao_nivel_ve_todas
--
--                     só as dele    todas do quadro
--   ver               view          view_all      (novo)
--   comentar          comment       comment_all   (novo)
--   editar            edit          full
--
-- Os acessos que já existem continuam fazendo EXATAMENTE o que faziam (nenhuma linha muda).
--
-- - gestao_resolver_nivel: na especificidade mais alta (task > list > folder > space) os grants
--   da pessoa e das equipes somam — maior capacidade, e "vê todas" se algum vê; restritivo é
--   teto nos dois eixos. Para os 4 níveis antigos o resultado é idêntico ao de antes.
-- - gestao_ve_tarefa e o aviso de "tarefa nova no quadro": "vê todas" em vez de "= full".
-- - gestao_alterar_acesso: membro comum não concede nenhum nível "vê todas" (antes só o full
--   era barrado) — senão quem só vê as próprias tarefas daria a outro a visão do quadro inteiro.
--
-- Os valores novos do tipo só aparecem como TEXTO nas funções (n::text), então a migration
-- roda numa transação só. Rollback: scripts/sql/v304_gestao_niveis_claros_rollback.sql

alter type public.gestao_nivel add value if not exists 'view_all';
alter type public.gestao_nivel add value if not exists 'comment_all';

-- o que a pessoa FAZ (1 ver · 2 comentar · 3 editar · 4 full)
create or replace function public.gestao_nivel_ord(n gestao_nivel)
returns integer language sql immutable set search_path to 'public' as $$
  select case n::text
           when 'view' then 1 when 'view_all' then 1
           when 'comment' then 2 when 'comment_all' then 2
           when 'edit' then 3
           when 'full' then 4
         end
$$;

-- o que a pessoa VÊ: todas as tarefas do quadro (true) ou só aquelas em que está (false)
create or replace function public.gestao_nivel_ve_todas(n gestao_nivel)
returns boolean language sql immutable set search_path to 'public' as $$
  select coalesce(n::text in ('full', 'view_all', 'comment_all'), false)
$$;

create or replace function public.gestao_resolver_nivel(p_email text, p_recurso_tipo gestao_recurso, p_recurso_id text)
returns gestao_nivel
language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  v_papel public.gestao_papel; v_quadro text; v_pasta uuid; v_espaco uuid; v_dono text;
  v_esp int; v_cap int; v_todas boolean; v_teto int; v_teto_todas boolean;
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

  -- Grant mais específico (task > list > folder > space). Principal = o próprio e-mail OU uma
  -- equipe ativa em que ele é membro. Na mesma especificidade os grants somam: a maior
  -- capacidade, e "vê todas" se algum deles vê.
  select max(case a.recurso_tipo when 'task' then 4 when 'list' then 3 when 'folder' then 2 else 1 end) into v_esp
    from public.gestao_acessos a
   where (lower(a.usuario_email)=lower(p_email) or a.id_equipe in (select public.gestao_equipes_de(p_email)))
     and ((a.recurso_tipo='task' and p_recurso_tipo='task' and a.recurso_id=p_recurso_id) or (a.recurso_tipo='list' and a.recurso_id=v_quadro)
       or (a.recurso_tipo='folder' and a.recurso_id=v_pasta::text) or (a.recurso_tipo='space' and a.recurso_id=v_espaco::text));
  if v_esp is null then return null; end if;

  select max(public.gestao_nivel_ord(a.nivel)), bool_or(public.gestao_nivel_ve_todas(a.nivel)) into v_cap, v_todas
    from public.gestao_acessos a
   where (lower(a.usuario_email)=lower(p_email) or a.id_equipe in (select public.gestao_equipes_de(p_email)))
     and ((a.recurso_tipo='task' and p_recurso_tipo='task' and a.recurso_id=p_recurso_id) or (a.recurso_tipo='list' and a.recurso_id=v_quadro)
       or (a.recurso_tipo='folder' and a.recurso_id=v_pasta::text) or (a.recurso_tipo='space' and a.recurso_id=v_espaco::text))
     and case a.recurso_tipo when 'task' then 4 when 'list' then 3 when 'folder' then 2 else 1 end = v_esp;

  -- Restritivo: teto nos dois eixos (a menor capacidade; "vê todas" só se todos os tetos veem).
  select min(public.gestao_nivel_ord(a.nivel)), bool_and(public.gestao_nivel_ve_todas(a.nivel)) into v_teto, v_teto_todas
    from public.gestao_acessos a
   where (lower(a.usuario_email)=lower(p_email) or a.id_equipe in (select public.gestao_equipes_de(p_email))) and a.restritivo
     and ((a.recurso_tipo='task' and p_recurso_tipo='task' and a.recurso_id=p_recurso_id) or (a.recurso_tipo='list' and a.recurso_id=v_quadro)
       or (a.recurso_tipo='folder' and a.recurso_id=v_pasta::text) or (a.recurso_tipo='space' and a.recurso_id=v_espaco::text));
  if v_teto is not null then
    v_cap := least(v_cap, v_teto);
    v_todas := v_todas and v_teto_todas;
  end if;

  if v_todas then
    return (case when v_cap >= 3 then 'full' when v_cap = 2 then 'comment_all' else 'view_all' end)::public.gestao_nivel;
  end if;
  return (case when v_cap >= 3 then 'edit' when v_cap = 2 then 'comment' else 'view' end)::public.gestao_nivel;
end $function$;

create or replace function public.gestao_ve_tarefa(p_id_tarefa text)
returns boolean
language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  v_email text;
  v_papel public.gestao_papel;
begin
  v_email := public.gestao_email();
  if v_email is null then
    return false;
  end if;
  v_papel := public.gestao_papel_de(v_email);
  if v_papel in ('owner','admin') then
    return true;
  end if;
  if v_papel is null then
    return false;
  end if;
  -- 4) nível que vê TODAS as tarefas do quadro + unidade (v294; v304: full, view_all, comment_all)
  if public.gestao_nivel_ve_todas(
       public.gestao_resolver_nivel(v_email, 'task'::public.gestao_recurso, p_id_tarefa)
     )
     and public.gestao_unidade_ok(v_email, p_id_tarefa) then
    return true;
  end if;
  if exists (
       select 1 from public.gestao_tarefas t
       join public.gestao_quadros q on q.id_quadro = t.id_quadro
       where t.id_tarefa = p_id_tarefa
         and q.dono_email is not null
         and coalesce(public.gestao_supervisiona(v_email, q.dono_email), false)
     ) then
    return true;
  end if;
  if exists (
       select 1 from public.gestao_acessos a
       where a.recurso_tipo = 'task'::public.gestao_recurso
         and a.recurso_id = p_id_tarefa
         and coalesce(a.restritivo, false) = false
         and lower(a.usuario_email) = v_email
     ) then
    return true;
  end if;
  if exists (
       select 1 from public.gestao_tarefa_vinculados v
       where v.id_tarefa = p_id_tarefa
         and lower(v.usuario_email) = v_email
     ) then
    return true;
  end if;
  if exists (
       select 1 from public.gestao_tarefas t
       where t.id_tarefa = p_id_tarefa
         and lower(t.created_by) = v_email
     ) then
    return true;
  end if;
  if exists (
       select 1 from public.gestao_subtarefas s
       where s.id_tarefa = p_id_tarefa
         and lower(s.responsavel_email) = v_email
     ) then
    return true;
  end if;
  -- 7.6) v300: subtarefa aberta como tarefa (id_tarefa_pai) -> quem ve a tarefa-mae ve a filha
  if exists (
       select 1 from public.gestao_tarefas t
       where t.id_tarefa = p_id_tarefa
         and t.id_tarefa_pai is not null
         and public.gestao_ve_tarefa(t.id_tarefa_pai)
     ) then
    return true;
  end if;
  return false;
end
$function$;

create or replace function public.gestao_aviso_quadro_trg()
returns trigger
language plpgsql security definer set search_path to 'public'
as $function$
DECLARE v_t record; v_q record; v_ator text := public.gestao_email(); r record;
BEGIN
  SELECT id_tarefa, id_quadro, titulo, id_tarefa_pai INTO v_t FROM public.gestao_tarefas WHERE id_tarefa = new.id_tarefa;
  IF NOT FOUND THEN RETURN null; END IF;
  IF v_t.id_tarefa_pai IS NOT NULL THEN RETURN null; END IF;   -- v300
  SELECT id_quadro, nome, id_pasta, id_espaco, dono_email INTO v_q FROM public.gestao_quadros WHERE id_quadro = v_t.id_quadro;
  IF NOT FOUND OR v_q.dono_email IS NOT NULL THEN RETURN null; END IF;

  FOR r IN
    WITH g AS (
      SELECT a.usuario_email, a.id_equipe FROM public.gestao_acessos a
       WHERE (a.recurso_tipo = 'list'   AND a.recurso_id = v_q.id_quadro)
          OR (a.recurso_tipo = 'folder' AND a.recurso_id = v_q.id_pasta::text)
          OR (a.recurso_tipo = 'space'  AND a.recurso_id = v_q.id_espaco::text)
    )
    SELECT DISTINCT lower(e) AS email FROM (
      SELECT g.usuario_email AS e FROM g WHERE g.usuario_email IS NOT NULL
      UNION ALL
      SELECT m.usuario_email FROM g JOIN public.gestao_equipe_membros m ON m.id_equipe = g.id_equipe
        JOIN public.gestao_equipes eq ON eq.id = m.id_equipe AND eq.ativo
    ) x
  LOOP
    -- Só quem vê TODAS as tarefas do quadro (v304: full, view_all, comment_all); vinculado já é avisado.
    IF public.gestao_nivel_ve_todas(public.gestao_resolver_nivel(r.email, 'task', v_t.id_tarefa))
       AND public.gestao_unidade_ok(r.email, v_t.id_tarefa)
       AND NOT EXISTS (SELECT 1 FROM public.gestao_tarefa_vinculados v WHERE v.id_tarefa = v_t.id_tarefa AND lower(v.usuario_email) = r.email) THEN
      PERFORM public.gestao_avisar(r.email, 'quadro', 'Nova tarefa em ' || v_q.nome || ': ' || v_t.titulo, v_t.id_tarefa, v_q.id_quadro, v_ator);
    END IF;
  END LOOP;
  RETURN null;
END $function$;

create or replace function public.gestao_alterar_acesso(p_alvo text, p_acao gestao_acao, p_recurso_tipo gestao_recurso, p_recurso_id text, p_nivel_novo gestao_nivel, p_motivo text)
returns uuid
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_ator text := public.gestao_email(); v_papel public.gestao_papel; v_ator_nivel public.gestao_nivel;
  v_ant public.gestao_nivel; v_log uuid; v_papel_legado text; v_id_quadro text;
begin
  if length(trim(coalesce(p_motivo,''))) < 5 then raise exception 'motivo obrigatório (mínimo 5 caracteres)'; end if;
  v_papel := public.gestao_papel_de(v_ator);
  if v_papel is null then raise exception 'apenas membros da Gestão podem gerenciar acesso'; end if;
  if v_papel = 'membro' then
    v_ator_nivel := public.gestao_resolver_nivel(v_ator, p_recurso_tipo, p_recurso_id);
    if v_ator_nivel is null or public.gestao_nivel_ord(v_ator_nivel) < 3 then raise exception 'sem permissão para gerenciar acesso neste recurso'; end if;
    -- v304: nenhum nível "vê todas as tarefas" é delegável por membro (antes só o full)
    if public.gestao_nivel_ve_todas(p_nivel_novo) then raise exception 'só gestor concede acesso a todas as tarefas do quadro'; end if;
    if public.gestao_nivel_ord(p_nivel_novo) > public.gestao_nivel_ord(v_ator_nivel) then raise exception 'não é possível conceder nível acima do próprio'; end if;
  end if;
  v_ant := (select nivel from public.gestao_acessos where lower(usuario_email)=lower(p_alvo) and recurso_tipo=p_recurso_tipo and recurso_id=p_recurso_id);
  if p_acao in ('removeu','revogou') then
    delete from public.gestao_acessos where lower(usuario_email)=lower(p_alvo) and recurso_tipo=p_recurso_tipo and recurso_id=p_recurso_id;
  else
    v_papel_legado := case when public.gestao_nivel_ord(p_nivel_novo) >= 3 then 'editor' else 'viewer' end;
    v_id_quadro := case when p_recurso_tipo = 'list' then p_recurso_id else null end;
    insert into public.gestao_acessos (id, usuario_email, recurso_tipo, recurso_id, nivel, concedido_por, id_quadro, papel)
      values (gen_random_uuid(), p_alvo, p_recurso_tipo, p_recurso_id, p_nivel_novo, v_ator, v_id_quadro, v_papel_legado)
    on conflict (lower(usuario_email), recurso_tipo, recurso_id) do update
      set nivel = excluded.nivel, concedido_por = excluded.concedido_por,
          id_quadro = excluded.id_quadro, papel = excluded.papel;
  end if;
  insert into public.gestao_acesso_log (ator_email, alvo_email, acao, recurso_tipo, recurso_id, nivel_anterior, nivel_novo, motivo)
    values (v_ator, p_alvo, p_acao, p_recurso_tipo, p_recurso_id, v_ant,
            case when p_acao in ('removeu','revogou') then null else p_nivel_novo end, p_motivo)
    returning id into v_log;
  return v_log;
end $function$;

revoke all on function public.gestao_nivel_ve_todas(gestao_nivel) from public, anon;
grant execute on function public.gestao_nivel_ve_todas(gestao_nivel) to authenticated, service_role;
