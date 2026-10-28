-- v306 — Inspeções: prioridade, prazo, tempo de espera e "Minhas inspeções" (28/10/2026)
--
-- Pedido de 28/10: filtros inteligentes na lista de Inspeções e uma página onde o técnico e o
-- associado veem só o que foi atribuído a eles, com prioridade, data e tempo de espera.
--
-- 1) Prioridade MANUAL e prazo: inspecoes.prioridade (BAIXA|MEDIA|ALTA|URGENTE), prazo e quem/
--    quando definiu. Só supervisor (Admin ou nível Aprovação/Admin — dashboard_caller_supervisor)
--    altera; o gatilho barra os outros (a RLS da tabela é aberta para escrita de quem edita).
-- 2) Colunas CALCULADAS (filtráveis e ordenáveis pelo PostgREST, como tecnicos_busca):
--    situacao_documento   ENTREGUE | EM_ELABORACAO | PENDENTE | null — a régua de
--                         lib/inspecoes/documento.ts (associado no documento conta como assumido;
--                         Pendente só depois que a inspeção sai do campo)
--    espera_desde         de quando conta a espera: inspeção aberta → data da visita (ou abertura);
--                         concluída com documento não entregue → data da conclusão; resto → null
--    dias_espera          hoje (São Paulo) − espera_desde
--    prioridade_auto      calculada: URGENTE (prazo vencido, documento vencido ou espera > 45 d),
--                         ALTA (prazo em até 3 d, validade em até 30 d ou espera > 30 d),
--                         MEDIA (prazo em até 7 d ou espera > 15 d), senão BAIXA; null se nada espera
--    prioridade_efetiva   a MAIOR entre a manual e a automática (o automático só sobe: atraso não
--                         some porque alguém marcou "Baixa"); null quando nada espera e não há manual
--    prioridade_ord       4 Urgente · 3 Alta · 2 Média · 1 Baixa · 0 sem — para ordenar
-- 3) inspecoes_atribuidas(p_id_usuario, p_papel): as inspeções da pessoa como TÉCNICO (foi a campo:
--    responsaveis.id_usuario, ou o nome digitado lá; sem ninguém na aba, quem abriu — a régua do
--    dashboard) ou como ASSOCIADO (inspecao_associados.id_usuario ou o nome; ou quem assumiu a
--    elaboração). Devolve linhas de `inspecoes` — a tela filtra/ordena/pagina por cima, com as
--    colunas calculadas. A própria pessoa ou supervisor; outro usuário → 42501.
--
-- Os limites (45/30/15 dias; 3/7 dias de prazo; 30 dias de validade) estão espelhados em
-- lib/inspecoes/prioridade.ts, que explica o motivo na tela. Rollback:
-- scripts/sql/v306_inspecoes_prioridade_atribuidas_rollback.sql

alter table public.inspecoes add column if not exists prioridade text;
alter table public.inspecoes add column if not exists prazo date;
alter table public.inspecoes add column if not exists prioridade_definida_por text;
alter table public.inspecoes add column if not exists prioridade_definida_em timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'inspecoes_prioridade_check') then
    alter table public.inspecoes add constraint inspecoes_prioridade_check
      check (prioridade is null or prioridade in ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE'));
  end if;
end $$;

-- Só supervisor mexe em prioridade/prazo; carimba quem e quando.
create or replace function public.inspecoes_prioridade_trg()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.prioridade is distinct from old.prioridade or new.prazo is distinct from old.prazo then
    if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' and not public.dashboard_caller_supervisor() then
      raise exception 'Só supervisor define a prioridade e o prazo da inspeção.' using errcode = '42501';
    end if;
    new.prioridade_definida_por := lower(coalesce(auth.jwt() ->> 'email', ''));
    new.prioridade_definida_em := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_inspecoes_prioridade on public.inspecoes;
create trigger trg_inspecoes_prioridade
  before update of prioridade, prazo on public.inspecoes
  for each row execute function public.inspecoes_prioridade_trg();

-- ── colunas calculadas ────────────────────────────────────────────────────────

create or replace function public.situacao_documento(i inspecoes)
returns text language sql stable set search_path to 'public' as $$
  select case
           when i.elaboracao_status = 'CONCLUIDO' then 'ENTREGUE'
           when i.elaboracao_status = 'EM_ELABORACAO' or public.tem_associado(i) then 'EM_ELABORACAO'
           when i.status = 'CONCLUIDA' then 'PENDENTE'
           else null
         end
$$;

create or replace function public.espera_desde(i inspecoes)
returns date language sql stable set search_path to 'public' as $$
  select case
           when i.status in ('RASCUNHO', 'EM_ANDAMENTO')
             then coalesce(i.data_inspecao, (i.created_at at time zone 'America/Sao_Paulo')::date)
           when i.status = 'CONCLUIDA' and coalesce(i.elaboracao_status, '') <> 'CONCLUIDO'
             then (coalesce(i.concluida_em, i.created_at) at time zone 'America/Sao_Paulo')::date
           else null
         end
$$;

create or replace function public.dias_espera(i inspecoes)
returns integer language sql stable set search_path to 'public' as $$
  select greatest(0, (now() at time zone 'America/Sao_Paulo')::date - public.espera_desde(i))
$$;

create or replace function public.prioridade_auto(i inspecoes)
returns text language sql stable set search_path to 'public' as $$
  with b as (
    select public.dias_espera(i) as espera,
           (now() at time zone 'America/Sao_Paulo')::date as hoje
  )
  select case
           when b.espera is null then null
           when (i.prazo is not null and i.prazo < b.hoje)
             or (i.data_validade is not null and i.data_validade < b.hoje)
             or b.espera > 45 then 'URGENTE'
           when (i.prazo is not null and i.prazo <= b.hoje + 3)
             or (i.data_validade is not null and i.data_validade <= b.hoje + 30)
             or b.espera > 30 then 'ALTA'
           when (i.prazo is not null and i.prazo <= b.hoje + 7)
             or b.espera > 15 then 'MEDIA'
           else 'BAIXA'
         end
    from b
$$;

create or replace function public.prioridade_peso(p text)
returns integer language sql immutable set search_path to 'public' as $$
  select case p when 'URGENTE' then 4 when 'ALTA' then 3 when 'MEDIA' then 2 when 'BAIXA' then 1 else 0 end
$$;

create or replace function public.prioridade_efetiva(i inspecoes)
returns text language sql stable set search_path to 'public' as $$
  select case
           when public.prioridade_peso(i.prioridade) >= public.prioridade_peso(public.prioridade_auto(i))
             then i.prioridade
           else public.prioridade_auto(i)
         end
$$;

create or replace function public.prioridade_ord(i inspecoes)
returns integer language sql stable set search_path to 'public' as $$
  select public.prioridade_peso(public.prioridade_efetiva(i))
$$;

-- ── inspeções atribuídas a uma pessoa ─────────────────────────────────────────

create or replace function public.inspecoes_atribuidas(p_id_usuario text default null, p_papel text default 'todos')
returns setof public.inspecoes
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_eu record;
  v_alvo record;
begin
  select u.id_usuario, lower(u.email) as email, u.nome into v_eu
    from public.usuarios u
   where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
     and coalesce(u.ativo_sistema, true);
  if not found then
    raise exception 'usuário não encontrado' using errcode = '42501';
  end if;

  if p_id_usuario is null or p_id_usuario = v_eu.id_usuario then
    v_alvo := v_eu;
  else
    if not public.dashboard_caller_supervisor() then
      raise exception 'só supervisor vê as inspeções de outra pessoa' using errcode = '42501';
    end if;
    select u.id_usuario, lower(u.email) as email, u.nome into v_alvo from public.usuarios u where u.id_usuario = p_id_usuario;
    if not found then
      raise exception 'usuário não encontrado' using errcode = 'P0002';
    end if;
  end if;

  return query
  select i.*
    from public.inspecoes i
   where i.status <> 'DELETADA'
     and (
       (p_papel in ('todos', 'tecnico') and (
          exists (select 1 from public.responsaveis r
                   where r.id_inspecao = i.id_inspecao
                     and (r.id_usuario = v_alvo.id_usuario
                          or (r.id_usuario is null and nullif(btrim(r.tecnico_responsavel), '') is not null
                              and lower(public.sem_acento(btrim(r.tecnico_responsavel))) = lower(public.sem_acento(btrim(v_alvo.nome))))))
          or (not exists (select 1 from public.responsaveis r
                           where r.id_inspecao = i.id_inspecao
                             and (r.id_usuario is not null or nullif(btrim(r.tecnico_responsavel), '') is not null))
              and lower(coalesce(i.usuario, '')) = v_alvo.email)))
       or
       (p_papel in ('todos', 'associado') and (
          exists (select 1 from public.inspecao_associados a
                   where a.id_inspecao = i.id_inspecao
                     and (a.id_usuario = v_alvo.id_usuario
                          or (nullif(btrim(a.nome), '') is not null
                              and lower(public.sem_acento(btrim(a.nome))) = lower(public.sem_acento(btrim(v_alvo.nome))))))
          or (nullif(btrim(i.elaboracao_responsavel), '') is not null
              and lower(public.sem_acento(btrim(i.elaboracao_responsavel))) = lower(public.sem_acento(btrim(v_alvo.nome))))))
     );
end $function$;

revoke all on function public.inspecoes_atribuidas(text, text) from public, anon;
grant execute on function public.inspecoes_atribuidas(text, text) to authenticated;

notify pgrst, 'reload schema';
