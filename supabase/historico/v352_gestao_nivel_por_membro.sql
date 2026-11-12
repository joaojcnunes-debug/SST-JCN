-- v352 — Gestão: nível de acesso POR FUNCIONÁRIO na equipe (12/11/2026, 0.3.284).
--
-- Trazida da v366 do Painel (0.3.946). A equipe continua dizendo ONDE (gestao_acessos com id_equipe); O QUE cada um
-- pode fazer passa a ser o nível dele em gestao_equipe_membros.nivel. Para acesso que vem por equipe, o resolvedor usa
-- o MENOR entre o nível da concessão da equipe e o do membro; acesso direto (por pessoa) não muda. Todo membro começa
-- em "full": com as concessões de equipe todas "full", ninguém ganha nem perde acesso.
-- Os corpos anteriores de gestao_resolver_nivel e gestao_acessos_efetivos no JCN eram iguais aos do Painel antes da
-- v366 (conferido em 12/11, sem espaços e comentários).
--
-- REAPLICAR: não (cria a coluna). ROLLBACK: scripts/sql/v352_gestao_nivel_por_membro_rollback.sql

begin;

do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'gestao_equipe_membros' and column_name = 'nivel') then
    raise exception 'v352: gestao_equipe_membros.nivel já existe';
  end if;
  -- todo membro começa em "full": só é neutro se as concessões de equipe forem todas "full"
  if exists (select 1 from public.gestao_acessos where id_equipe is not null and nivel is distinct from 'full') then
    raise exception 'v352: há concessão de equipe com nível diferente de "full" — rever antes (o início em "full" deixaria de ser neutro)';
  end if;
end $$;

alter table public.gestao_equipe_membros add column nivel public.gestao_nivel not null default 'full';
comment on column public.gestao_equipe_membros.nivel is
  'v352: o que o membro pode fazer nos acessos da equipe (o resolvedor usa o menor entre este e o da concessão da equipe).';

-- O menor de dois níveis nos dois eixos: capacidade (ver < comentar < editar < completo) e "vê todas as tarefas".
-- Um nulo não limita (devolve o outro).
create or replace function public.gestao_nivel_menor(a public.gestao_nivel, b public.gestao_nivel)
returns public.gestao_nivel language sql immutable set search_path = public as $fn$
  select case
    when a is null then b
    when b is null then a
    when public.gestao_nivel_ve_todas(a) and public.gestao_nivel_ve_todas(b) then
      (case least(public.gestao_nivel_ord(a), public.gestao_nivel_ord(b)) when 4 then 'full' when 3 then 'full' when 2 then 'comment_all' else 'view_all' end)::public.gestao_nivel
    else
      (case least(public.gestao_nivel_ord(a), public.gestao_nivel_ord(b)) when 4 then 'edit' when 3 then 'edit' when 2 then 'comment' else 'view' end)::public.gestao_nivel
  end
$fn$;

CREATE OR REPLACE FUNCTION public.gestao_resolver_nivel(p_email text, p_recurso_tipo gestao_recurso, p_recurso_id text)
 RETURNS gestao_nivel
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- v366: acesso que vem por EQUIPE vale no nível do MEMBRO (o menor entre o do acesso da equipe e o dele).
  select max(public.gestao_nivel_ord(public.gestao_nivel_menor(a.nivel, m.nivel))),
         bool_or(public.gestao_nivel_ve_todas(public.gestao_nivel_menor(a.nivel, m.nivel))) into v_cap, v_todas
    from public.gestao_acessos a
    left join public.gestao_equipe_membros m on a.id_equipe is not null and m.id_equipe = a.id_equipe and lower(m.usuario_email) = lower(p_email)
   where (lower(a.usuario_email)=lower(p_email) or a.id_equipe in (select public.gestao_equipes_de(p_email)))
     and ((a.recurso_tipo='task' and p_recurso_tipo='task' and a.recurso_id=p_recurso_id) or (a.recurso_tipo='list' and a.recurso_id=v_quadro)
       or (a.recurso_tipo='folder' and a.recurso_id=v_pasta::text) or (a.recurso_tipo='space' and a.recurso_id=v_espaco::text))
     and case a.recurso_tipo when 'task' then 4 when 'list' then 3 when 'folder' then 2 else 1 end = v_esp;

  -- Restritivo: teto nos dois eixos (a menor capacidade; "vê todas" só se todos os tetos veem).
  select min(public.gestao_nivel_ord(public.gestao_nivel_menor(a.nivel, m.nivel))),
         bool_and(public.gestao_nivel_ve_todas(public.gestao_nivel_menor(a.nivel, m.nivel))) into v_teto, v_teto_todas
    from public.gestao_acessos a
    left join public.gestao_equipe_membros m on a.id_equipe is not null and m.id_equipe = a.id_equipe and lower(m.usuario_email) = lower(p_email)
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

CREATE OR REPLACE FUNCTION public.gestao_acessos_efetivos(p_email text DEFAULT NULL::text, p_id_quadro text DEFAULT NULL::text)
 RETURNS TABLE(email text, nome text, id_quadro text, quadro text, nivel gestao_nivel, origens jsonb, unidades text[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
begin
  if not coalesce(public.gestao_eh_gestor(public.gestao_email()), false) then
    raise exception 'apenas gestores da Gestão veem os acessos' using errcode = '42501';
  end if;

  return query
  with pessoas as (
    select lower(u.email)::text as email, u.nome::text as nome, public.gestao_papel_de(u.email) as papel
      from public.usuarios u
     where u.ativo_sistema = true
       and u.perfil is distinct from 'Cliente'
       and (p_email is null or lower(u.email) = lower(p_email))
  ), quadros as (
    select q.id_quadro, q.nome, q.id_pasta, q.id_espaco
      from public.gestao_quadros q
     where q.dono_email is null
       and (p_id_quadro is null or q.id_quadro = p_id_quadro)
  )
  select p.email, p.nome, q.id_quadro::text, q.nome::text, n.nivel,
         case when p.papel in ('owner', 'admin') then jsonb_build_array(jsonb_build_object('tipo', 'gestor'))
         else coalesce((
           select jsonb_agg(jsonb_build_object(
                    'tipo', case when a.id_equipe is null then 'direto' else 'equipe' end,
                    'equipe', e.nome,
                    'recurso', a.recurso_tipo,
                    'nome_recurso', case a.recurso_tipo when 'list' then q.nome when 'folder' then pa.nome else es.nome end,
                    'nivel', public.gestao_nivel_menor(a.nivel, (select mm.nivel from public.gestao_equipe_membros mm where a.id_equipe is not null and mm.id_equipe = a.id_equipe and lower(mm.usuario_email) = p.email)),
                    'restritivo', coalesce(a.restritivo, false))
                  order by case a.recurso_tipo when 'list' then 1 when 'folder' then 2 else 3 end, e.nome nulls first)
             from public.gestao_acessos a
             left join public.gestao_equipes e on e.id = a.id_equipe
             left join public.gestao_pastas pa on a.recurso_tipo = 'folder' and pa.id::text = a.recurso_id
             left join public.gestao_espacos es on a.recurso_tipo = 'space' and es.id::text = a.recurso_id
            where (lower(a.usuario_email) = p.email or a.id_equipe in (select public.gestao_equipes_de(p.email)))
              and ((a.recurso_tipo = 'list' and a.recurso_id = q.id_quadro)
                or (a.recurso_tipo = 'folder' and a.recurso_id = q.id_pasta::text)
                or (a.recurso_tipo = 'space' and a.recurso_id = q.id_espaco::text))
         ), '[]'::jsonb) end,
         (select m.unidades from public.gestao_membros m where lower(m.usuario_email) = p.email and m.ativo limit 1)
    from pessoas p
    cross join quadros q
    cross join lateral (select public.gestao_resolver_nivel(p.email, 'list', q.id_quadro) as nivel) n
   where p.papel is not null
     and n.nivel is not null
   order by p.nome, q.nome;
end $function$;

-- Muda o nível de um funcionário numa equipe (só gestor; motivo e histórico como os demais acessos).
create or replace function public.gestao_equipe_definir_nivel(p_id_equipe uuid, p_email text, p_nivel public.gestao_nivel, p_motivo text)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_ator text := public.gestao_email(); v_nome text; v_ant public.gestao_nivel;
begin
  if not coalesce(public.gestao_eh_gestor(v_ator), false) then raise exception 'apenas Owner/Admin gerenciam equipes'; end if;
  if p_nivel is null then raise exception 'escolha o nível'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 5 then raise exception 'motivo obrigatório (mínimo 5 caracteres)'; end if;
  select nome into v_nome from public.gestao_equipes where id = p_id_equipe;
  if v_nome is null then raise exception 'equipe não encontrada'; end if;
  select nivel into v_ant from public.gestao_equipe_membros where id_equipe = p_id_equipe and lower(usuario_email) = lower(p_email) for update;
  if not found then raise exception 'a pessoa não está na equipe'; end if;
  if v_ant = p_nivel then return; end if;
  update public.gestao_equipe_membros set nivel = p_nivel where id_equipe = p_id_equipe and lower(usuario_email) = lower(p_email);
  insert into public.gestao_acesso_log (ator_email, alvo_email, acao, nivel_anterior, nivel_novo, motivo)
  values (v_ator, lower(p_email), 'alterou_nivel', v_ant, p_nivel, 'equipe "' || v_nome || '": ' || trim(p_motivo));
end $fn$;

revoke all on function public.gestao_nivel_menor(public.gestao_nivel, public.gestao_nivel) from public, anon;
grant execute on function public.gestao_nivel_menor(public.gestao_nivel, public.gestao_nivel) to authenticated;
revoke all on function public.gestao_equipe_definir_nivel(uuid, text, public.gestao_nivel, text) from public, anon;
grant execute on function public.gestao_equipe_definir_nivel(uuid, text, public.gestao_nivel, text) to authenticated;


notify pgrst, 'reload schema';

notify pgrst, 'reload schema';

commit;
