-- v346 — Gestão: responsável sugerido pelo histórico (11/11/2026, 0.3.275).
--
-- Trazida da v356 do Painel (0.3.925). gestao_sugerir_responsaveis(quadro, texto): quem foi responsável pelas tarefas de
-- título mais parecido do MESMO quadro nos últimos 18 meses (as 40 mais parecidas, semelhança ≥ 0,25; pesa a soma da
-- semelhança). Até 3 pessoas. Conta feita no banco (pg_trgm + unaccent) — nada vai para IA externa.
-- SECURITY INVOKER na de fora: só entram as tarefas que a pessoa vê e as pessoas ativas que ela vê em usuarios.
-- Diferença do Painel: aqui pg_trgm e unaccent ficam no esquema `extensions` (chamadas qualificadas).
--
-- REAPLICAR: idempotente. ROLLBACK: scripts/sql/v346_gestao_responsavel_sugerido_rollback.sql

begin;

do $$ begin
  if to_regprocedure('extensions.similarity(text,text)') is null or to_regprocedure('extensions.unaccent(text)') is null then
    raise exception 'v346: faltam pg_trgm / unaccent no esquema extensions';
  end if;
  if to_regprocedure('public.gestao_pode_ver(text)') is null or to_regprocedure('public.gestao_ve_tarefa(text)') is null then
    raise exception 'v346: faltam gestao_pode_ver(text) / gestao_ve_tarefa(text)';
  end if;
end $$;

-- As tarefas parecidas que a pessoa vê: confere o quadro UMA vez (gestao_pode_ver), separa as 80 mais parecidas e só
-- nelas aplica gestao_ve_tarefa (a mesma regra da RLS). Devolve só id e semelhança.
create or replace function public.gestao_tarefas_parecidas(p_id_quadro text, p_texto text)
returns table (id_tarefa text, s real)
  language plpgsql stable security definer set search_path = public, extensions as $fn$
#variable_conflict use_column
declare
  v_t text := lower(extensions.unaccent(btrim(coalesce(p_texto, ''))));
begin
  if length(v_t) < 4 or not coalesce(public.gestao_pode_ver(p_id_quadro), false) then return; end if;
  return query
    select c.id_tarefa, c.s
      from (
        select o.id_tarefa, extensions.similarity(lower(extensions.unaccent(o.titulo)), v_t) as s
          from public.gestao_tarefas o
         where o.id_quadro = p_id_quadro
           and o.id_tarefa_pai is null
           and o.created_at > now() - interval '18 months'
         order by 2 desc
         limit 80
      ) c
     where c.s >= 0.25
       and coalesce(public.gestao_ve_tarefa(c.id_tarefa), false)
     order by c.s desc
     limit 40;
end $fn$;

-- Quem foi responsável por elas. INVOKER: vínculos e pessoas pela RLS.
create or replace function public.gestao_sugerir_responsaveis(p_id_quadro text, p_texto text)
returns table (email text, nome text, tarefas int)
  language sql stable security invoker set search_path = public as $fn$
  select lower(v.usuario_email), min(u.nome), count(*)::int
    from public.gestao_tarefas_parecidas(p_id_quadro, p_texto) p
    join public.gestao_tarefa_vinculados v on v.id_tarefa = p.id_tarefa and v.tipo = 'responsavel'
    join public.usuarios u on lower(u.email) = lower(v.usuario_email) and u.ativo_sistema
   group by 1
   order by sum(p.s) desc, count(*) desc
   limit 3
$fn$;

revoke all on function public.gestao_tarefas_parecidas(text, text) from public, anon;
revoke all on function public.gestao_sugerir_responsaveis(text, text) from public, anon;
grant execute on function public.gestao_tarefas_parecidas(text, text) to authenticated;
grant execute on function public.gestao_sugerir_responsaveis(text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
