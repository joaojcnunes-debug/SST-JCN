-- v358 — Gestão › Colaboradores: o supervisor vê só as equipes dele; todos, só o dono da Gestão e o Admin do sistema
-- (17/11/2026, 0.3.293).
--
-- POR QUÊ: pedido do João. Em Colaboradores, cada supervisor deve ver só os colaboradores das equipes em que é
-- supervisor (cadastradas em Membros e acessos › Equipes); ver todos fica para o dono da Gestão (papel owner) e
-- para quem tem perfil Admin no cadastro de usuários (decisão dele em 17/11). Antes, qualquer admin da Gestão via
-- todos (gestao_eh_gestor), e quem é admin da Gestão só por organizar listas via a empresa inteira.
--
-- O QUE FAZ:
--   gestao_ve_todos_colaboradores(email)  owner da Gestão OU usuarios.perfil = 'Admin'.
--   gestao_colaboradores_visiveis()       igual à v235, trocando gestao_eh_gestor por gestao_ve_todos_colaboradores.
--   Os outros poderes do admin da Gestão (Membros e acessos, Produtos, abrir qualquer lista) não mudam.
--   Nenhuma tabela muda.
--
-- REAPLICAR: idempotente. ROLLBACK: scripts/sql/v358_gestao_colaboradores_supervisor_rollback.sql
begin;

create or replace function public.gestao_ve_todos_colaboradores(p_email text)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select coalesce(public.gestao_papel_de(p_email)::text = 'owner', false)
      or exists (select 1 from public.usuarios u
                  where lower(u.email) = lower(p_email) and u.perfil = 'Admin' and coalesce(u.ativo_sistema, true));
$function$;

revoke all on function public.gestao_ve_todos_colaboradores(text) from public, anon;
grant execute on function public.gestao_ve_todos_colaboradores(text) to authenticated;

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
       -- v358: todos só para o dono da Gestão e o Admin do sistema; o supervisor, só as equipes dele.
       and (public.gestao_ve_todos_colaboradores(eu.email) or public.gestao_supervisiona(eu.email, u.email))
  )
  select b.email, b.nome, q.id_quadro,
         coalesce((select array_agg(e.nome order by e.nome) from public.gestao_equipe_membros m join public.gestao_equipes e on e.id=m.id_equipe and e.ativo where lower(m.usuario_email)=b.email), '{}'::text[]),
         public.gestao_papel_de(b.email)::text
    from base b
    left join public.gestao_quadros q on lower(q.dono_email)=b.email
   order by b.nome;
$function$;

notify pgrst, 'reload schema';

commit;
