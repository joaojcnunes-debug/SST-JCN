-- ROLLBACK v358 — volta a gestao_colaboradores_visiveis da v235 (qualquer admin da Gestão vê todos) e tira a
-- gestao_ve_todos_colaboradores. Volte antes o código (0.3.293), que mostra o menu só para quem recebe alguém.
begin;

create or replace function public.gestao_colaboradores_visiveis()
 returns table(usuario_email text, nome text, id_quadro text, equipes text[], papel_gestao text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
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
$function$;

drop function if exists public.gestao_ve_todos_colaboradores(text);

notify pgrst, 'reload schema';
commit;
