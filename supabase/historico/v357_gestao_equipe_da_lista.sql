-- v357 — Gestão: a equipe de uma lista, para o seletor de Responsável/Alocado (17/11/2026, 0.3.292).
--
-- POR QUÊ: pedido do João — "puxar somente as pessoas (equipe) que fazem parte da lista". A gestao_pessoas_do_quadro
-- (v315) não serve: ela deixa de fora owner/admin da Gestão (veem tudo), e no JCN quase todo mundo que trabalha nas
-- listas é admin, então o seletor ficava vazio.
--
-- O QUE FAZ: gestao_equipe_da_lista(p_id_quadro) → (email, nome) de quem foi COLOCADO na lista em Membros e acessos:
-- concessão direta ou por equipe ativa, na lista, na pasta ou no espaço dela — qualquer papel, inclusive admin.
-- Meu Quadro (lista pessoal): o dono. Só usuários ativos e não Cliente. Só responde para quem vê a lista
-- (gestao_pode_ver). Só leitura; nenhuma tabela muda.
--
-- REAPLICAR: idempotente. ROLLBACK: scripts/sql/v357_gestao_equipe_da_lista_rollback.sql
begin;

create or replace function public.gestao_equipe_da_lista(p_id_quadro text)
returns table(email text, nome text)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_pasta uuid; v_espaco uuid; v_dono text;
begin
  if not coalesce(public.gestao_pode_ver(p_id_quadro), false) then
    raise exception 'sem acesso a este quadro' using errcode = '42501';
  end if;
  select q.id_pasta, q.id_espaco, q.dono_email into v_pasta, v_espaco, v_dono from public.gestao_quadros q where q.id_quadro = p_id_quadro;

  return query
  with concessoes as (
    select a.usuario_email, a.id_equipe
      from public.gestao_acessos a
     where (a.recurso_tipo = 'list' and a.recurso_id = p_id_quadro)
        or (a.recurso_tipo = 'folder' and a.recurso_id = v_pasta::text)
        or (a.recurso_tipo = 'space' and a.recurso_id = v_espaco::text)
  ),
  emails as (
    select lower(c.usuario_email) as e from concessoes c where c.usuario_email is not null
    union
    select lower(m.usuario_email)
      from concessoes c
      join public.gestao_equipes eq on eq.id = c.id_equipe and eq.ativo
      join public.gestao_equipe_membros m on m.id_equipe = c.id_equipe
    union
    select lower(v_dono) where v_dono is not null
  )
  select lower(u.email)::text, u.nome::text
    from public.usuarios u
    join emails x on x.e = lower(u.email)
   where coalesce(u.ativo_sistema, true)
     and u.perfil is distinct from 'Cliente'
   order by u.nome;
end $function$;

revoke all on function public.gestao_equipe_da_lista(text) from public, anon;
grant execute on function public.gestao_equipe_da_lista(text) to authenticated;

notify pgrst, 'reload schema';

commit;
