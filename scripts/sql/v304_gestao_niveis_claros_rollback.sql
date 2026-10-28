-- Rollback da v304 (níveis claros). Rodar DEPOIS de voltar o código.
-- O tipo gestao_nivel não perde valores (o Postgres não remove valor de enum). Os acessos com os
-- níveis novos viram o nível antigo mais próximo SEM ganhar poder: view_all → view e
-- comment_all → comment (a pessoa passa a ver só as tarefas em que está). Confira antes:
--   select usuario_email, id_equipe, recurso_tipo, recurso_id, nivel from public.gestao_acessos
--    where nivel::text in ('view_all','comment_all');

update public.gestao_acessos set nivel = 'view'    where nivel::text = 'view_all';
update public.gestao_acessos set nivel = 'comment' where nivel::text = 'comment_all';

create or replace function public.gestao_nivel_ord(n gestao_nivel)
returns integer language sql immutable set search_path to 'public' as $$
  select case n when 'view' then 1 when 'comment' then 2 when 'edit' then 3 when 'full' then 4 end
$$;

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
  if v_dono is not null then
    if lower(v_dono) = lower(p_email) then return 'full'; end if;
    if public.gestao_supervisiona(p_email, v_dono) then return 'edit'; end if;
    return null;
  end if;
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

-- gestao_ve_tarefa, gestao_aviso_quadro_trg e gestao_alterar_acesso: as versões da v304 continuam
-- corretas com os 4 níveis antigos (gestao_nivel_ve_todas('full') = true, os outros = false),
-- então ficam. gestao_nivel_ve_todas também fica (usada por elas).
