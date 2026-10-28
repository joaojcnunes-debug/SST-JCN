-- v305 — Gestão: acesso efetivo por pessoa e por lista (28/10/2026)
--
-- Base das abas "Por pessoa" e "Por lista" (Compartilhar) de Membros e acessos: para cada
-- pessoa da Gestão × lista (não pessoal), o nível que ela TEM de fato — o mesmo
-- gestao_resolver_nivel que o banco usa — e DE ONDE ele vem (grant direto na lista, na pasta ou
-- no espaço, por equipe, restritivo, ou administrador). Também devolve as unidades da pessoa na
-- Gestão (gestao_membros.unidades), que limitam as tarefas que ela vê.
--
-- Só gestor (owner/admin) chama: é a mesma régua de quem abre o modal e de quem lê o log.
-- Só leitura. Rollback: scripts/sql/v305_gestao_acessos_efetivos_rollback.sql

create or replace function public.gestao_acessos_efetivos(p_email text default null, p_id_quadro text default null)
returns table(email text, nome text, id_quadro text, quadro text, nivel gestao_nivel, origens jsonb, unidades text[])
language plpgsql stable security definer set search_path to 'public'
as $function$
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

revoke all on function public.gestao_acessos_efetivos(text, text) from public, anon;
grant execute on function public.gestao_acessos_efetivos(text, text) to authenticated;
