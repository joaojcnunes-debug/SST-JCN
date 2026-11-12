-- Desfaz a v352 (nível por funcionário na equipe): volta o resolvedor e os acessos efetivos de antes; a coluna
-- gestao_equipe_membros.nivel fica (sem efeito). Quem tinha nível menor que o da equipe volta ao nível da equipe.
begin;
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
                    'nivel', a.nivel,
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

drop function if exists public.gestao_equipe_definir_nivel(uuid, text, public.gestao_nivel, text);
drop function if exists public.gestao_nivel_menor(public.gestao_nivel, public.gestao_nivel);
notify pgrst, 'reload schema';
commit;
