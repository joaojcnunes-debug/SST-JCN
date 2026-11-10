-- v341 — Gestão: requisitos da etapa, tempo estimado, prazo de atendimento e comentário atribuído (10/11/2026, 0.3.268).
--
-- Trazida da v353 do Painel SST (0.3.920), itens 6, 7, 8 e 10 (o 9 — automações que rodaram na tarefa — é só tela):
--   6. Requisitos por coluna ("checklist completo" e "ter anexo"): barra quem move à mão; Admin força (fica registrado).
--      Automações, agendador e quem não está logado nunca são barrados.
--   7. Tempo estimado (minutos) na tarefa.
--   8. Prazo de atendimento por quadro (1ª resposta e resolução por prioridade, em horário comercial). No Painel vem
--      ligado nos quadros da OS da T.I; no JCN não vem ligado em nenhum quadro — liga-se por quadro, na tela.
--   10. Comentário atribuído (atribuido_a + resolvido_em/por), aviso a quem recebe, resolver por RPC.
-- Diferenças do Painel: sem a OS da T.I (v340 do Painel), sem tarefas restritas (v306), sem backup_operator e sem
-- schema_migrations; aviso de prazo sem responsável não vai a ninguém (no Painel ia à equipe T.I da Chabra).
-- Rollback: scripts/sql/v341_gestao_requisitos_estimativa_prazo_comentario_rollback.sql
begin;

do $$
begin
  if to_regclass('public.gestao_checklist_itens') is null then raise exception 'v341: falta gestao_checklist_itens (v339)'; end if;
  if to_regprocedure('public.gestao_avisar(text,text,text,text,text,text)') is null then raise exception 'v341: falta gestao_avisar'; end if;
  if to_regprocedure('public.is_admin_caller()') is null then raise exception 'v341: falta is_admin_caller'; end if;
end $$;

-- E-mail de quem está logado, ou null — sem erro quando request.jwt.claims vem vazio ('' depois de um set_config):
-- o gestao_email() lê o JSON e quebra com ''. (A gestao_tarefa_historico_trg já se protegia assim.)
create or replace function public.gestao_email_ou_nulo() returns text language plpgsql stable set search_path = public as $fn$
begin
  return public.gestao_email();
exception when others then
  return null;
end $fn$;

-- v339 (= v351 do Painel) endurecida: o gatilho do checklist quebrava com claims vazio (achado no ensaio da v353 do Painel).
create or replace function public.gestao_checklist_item_trg() returns trigger
  language plpgsql set search_path = public as $fn$
declare v_email text := public.gestao_email_ou_nulo();
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(v_email, new.created_by);
    if new.feito then
      new.feito_por := coalesce(v_email, new.feito_por);
      new.feito_em := now();
    else
      new.feito_por := null;
      new.feito_em := null;
    end if;
  else
    new.created_by := old.created_by;
    if new.feito is distinct from old.feito then
      if new.feito then
        new.feito_por := v_email;
        new.feito_em := now();
      else
        new.feito_por := null;
        new.feito_em := null;
      end if;
    else
      new.feito_por := old.feito_por;
      new.feito_em := old.feito_em;
    end if;
  end if;
  return new;
end $fn$;

-- ═══ 6. Requisitos da etapa ═══════════════════════════════════════════════════════════════════════════════════
alter table public.gestao_status add column if not exists requer_checklist boolean not null default false;
alter table public.gestao_status add column if not exists requer_anexo boolean not null default false;
comment on column public.gestao_status.requer_checklist is 'v341 (Painel v353): para ENTRAR nesta coluna, todos os itens do checklist marcados (sem itens = cumprido).';
comment on column public.gestao_status.requer_anexo is 'v341 (Painel v353): para ENTRAR nesta coluna, pelo menos um anexo na tarefa.';

-- O que falta para a tarefa entrar na coluna p_status do quadro p_quadro (vazio = pode).
create or replace function public.gestao_requisitos_faltando(p_id_tarefa text, p_quadro text, p_status text)
returns text[] language sql stable security definer set search_path = public as $fn$
  select coalesce((
    select array_remove(array[
      case when s.requer_checklist and exists (select 1 from public.gestao_checklist_itens c where c.id_tarefa = p_id_tarefa and not c.feito)
           then 'marcar todo o checklist' end,
      case when s.requer_anexo and not exists (select 1 from public.gestao_anexos a where a.id_tarefa = p_id_tarefa)
           then 'anexar pelo menos um arquivo' end
    ], null)
      from public.gestao_status s
     where s.id_quadro = p_quadro and s.slug = p_status
  ), '{}'::text[]);
$fn$;

create or replace function public.gestao_requisitos_etapa_trg() returns trigger
  language plpgsql security definer set search_path = public as $fn$
declare v_falta text[]; v_nome text;
begin
  if new.status is not distinct from old.status then return new; end if;
  -- Só barra a pessoa movendo à mão. Livres: gatilhos (profundidade > 1), sem login de usuário (agendador, Runrun,
  -- service_role), o "Forçar" do Admin e QUALQUER automação — inclusive as que rodam fora de gatilho com o login da
  -- pessoa (gestao_decidir_aprovacao → gestao_automacao_run; gestao_automacao_executar_manual), que ligam
  -- gestao.autom_depth enquanto executam as regras.
  if pg_trigger_depth() > 1
     or coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'role' is distinct from 'authenticated'
     or coalesce(current_setting('gestao.forcar_requisito', true), '') = 'on'
     or coalesce(current_setting('gestao.autom_depth', true), '') ~ '^[1-9]' then
    return new;
  end if;
  v_falta := public.gestao_requisitos_faltando(new.id_tarefa, new.id_quadro, new.status);
  if cardinality(v_falta) > 0 then
    select nome into v_nome from public.gestao_status where id_quadro = new.id_quadro and slug = new.status;
    raise exception 'Requisito da etapa: para entrar em "%" falta %.', coalesce(v_nome, new.status), array_to_string(v_falta, ' e ')
      using errcode = 'P0001', hint = 'requisito_etapa';
  end if;
  return new;
end $fn$;

drop trigger if exists gestao_requisitos_etapa on public.gestao_tarefas;
create trigger gestao_requisitos_etapa before update of status on public.gestao_tarefas
  for each row execute function public.gestao_requisitos_etapa_trg();

-- Admin força a mudança de coluna sem cumprir o requisito; fica no histórico (gestao_atividades 'requisito_forcado').
create or replace function public.gestao_mover_forcando_requisito(p_id_tarefa text, p_status text) returns void
  language plpgsql security definer set search_path = public as $fn$
declare v_q text; v_de text; v_falta text[];
begin
  if not public.is_admin_caller() then
    raise exception 'Só Admin pode forçar o requisito da etapa.' using errcode = '42501';
  end if;
  select id_quadro, status into v_q, v_de from public.gestao_tarefas where id_tarefa = p_id_tarefa;
  if not found then raise exception 'Tarefa não encontrada.'; end if;
  if not exists (select 1 from public.gestao_status where id_quadro = v_q and slug = p_status) then
    raise exception 'Essa coluna não é deste quadro.';
  end if;
  v_falta := public.gestao_requisitos_faltando(p_id_tarefa, v_q, p_status);
  perform set_config('gestao.forcar_requisito', 'on', true);
  update public.gestao_tarefas set status = p_status, updated_at = now() where id_tarefa = p_id_tarefa;
  perform set_config('gestao.forcar_requisito', '', true);
  insert into public.gestao_atividades (id, ator, acao, id_tarefa, payload)
  values (gen_random_uuid(),
          coalesce((select u.nome from public.usuarios u where lower(u.email) = public.gestao_email()), public.gestao_email()),
          'requisito_forcado', p_id_tarefa,
          jsonb_build_object('de', v_de, 'para', p_status, 'faltava', to_jsonb(v_falta)));
end $fn$;

revoke all on function public.gestao_requisitos_faltando(text, text, text), public.gestao_mover_forcando_requisito(text, text) from public, anon;
grant execute on function public.gestao_requisitos_faltando(text, text, text), public.gestao_mover_forcando_requisito(text, text) to authenticated;
revoke all on function public.gestao_requisitos_etapa_trg() from public, anon, authenticated;

-- ═══ 7. Tempo estimado ════════════════════════════════════════════════════════════════════════════════════════
alter table public.gestao_tarefas add column if not exists tempo_estimado_min integer;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'gestao_tarefas_tempo_estimado_min_chk') then
    alter table public.gestao_tarefas add constraint gestao_tarefas_tempo_estimado_min_chk
      check (tempo_estimado_min is null or tempo_estimado_min >= 0);
  end if;
end $$;
comment on column public.gestao_tarefas.tempo_estimado_min is 'v341 (Painel v353): tempo estimado da tarefa, em minutos (comparado com o gestao_tempo apontado).';

-- ═══ 8. Prazo de atendimento ══════════════════════════════════════════════════════════════════════════════════
create table if not exists public.gestao_sla_quadros (
  id_quadro text primary key references public.gestao_quadros(id_quadro) on delete cascade,
  ativo boolean not null default true,
  -- {"Urgente":{"resposta":120,"resolucao":480}, ...} — minutos ÚTEIS, chave = gestao_tarefas.prioridade
  metas jsonb not null,
  hora_inicio time not null default '08:00',
  hora_fim time not null default '18:00',
  dias int[] not null default '{1,2,3,4,5}',      -- isodow (1 = segunda)
  vigente_desde timestamptz not null default now(), -- chamado aberto antes disso não conta
  updated_by text,
  updated_at timestamptz not null default now(),
  check (hora_fim > hora_inicio)
);
comment on table public.gestao_sla_quadros is 'v341 (Painel v353): prazo de atendimento por quadro (1ª resposta e resolução por prioridade, em horário comercial).';

revoke all on public.gestao_sla_quadros from authenticated, anon, public;
grant select, insert, update, delete on public.gestao_sla_quadros to authenticated;
alter table public.gestao_sla_quadros enable row level security;
drop policy if exists gestao_sla_quadros_sel on public.gestao_sla_quadros;
create policy gestao_sla_quadros_sel on public.gestao_sla_quadros for select to authenticated
  using (gestao_pode_ver(id_quadro));
drop policy if exists gestao_sla_quadros_wr on public.gestao_sla_quadros;
create policy gestao_sla_quadros_wr on public.gestao_sla_quadros for all to authenticated
  using (gestao_pode_editar_q(id_quadro)) with check (gestao_pode_editar_q(id_quadro));

create or replace function public.gestao_sla_quadro_trg() returns trigger language plpgsql set search_path = public as $fn$
begin
  new.updated_by := coalesce(public.gestao_email_ou_nulo(), new.updated_by);
  new.updated_at := now();
  if tg_op = 'UPDATE' then new.vigente_desde := old.vigente_desde; end if;
  return new;
end $fn$;
drop trigger if exists gestao_sla_quadro_trg on public.gestao_sla_quadros;
create trigger gestao_sla_quadro_trg before insert or update on public.gestao_sla_quadros
  for each row execute function public.gestao_sla_quadro_trg();

-- Avisos já mandados (um de cada tipo por tarefa).
create table if not exists public.gestao_sla_avisos (
  id_tarefa text not null references public.gestao_tarefas(id_tarefa) on delete cascade,
  tipo text not null check (tipo in ('resposta_estourou', 'resolucao_75', 'resolucao_estourou')),
  created_at timestamptz not null default now(),
  primary key (id_tarefa, tipo)
);
revoke all on public.gestao_sla_avisos from authenticated, anon, public;
alter table public.gestao_sla_avisos enable row level security;   -- sem policy: só uso interno

-- Soma p_minutos úteis a p_inicio (expediente p_hi–p_hf nos dias p_dias, horário de Brasília).
create or replace function public.gestao_sla_somar(p_inicio timestamptz, p_minutos int, p_hi time, p_hf time, p_dias int[])
returns timestamptz language plpgsql stable set search_path = public as $fn$
declare
  t timestamp := p_inicio at time zone 'America/Sao_Paulo';
  resto int := p_minutos;
  disp int;
  voltas int := 0;
begin
  if p_inicio is null or p_minutos is null then return null; end if;
  if p_minutos <= 0 then return p_inicio; end if;
  loop
    voltas := voltas + 1;
    exit when voltas > 800;
    if not (extract(isodow from t)::int = any(p_dias)) or t::time >= p_hf then
      t := (t::date + 1) + p_hi;
      continue;
    end if;
    if t::time < p_hi then t := t::date + p_hi; end if;
    disp := floor(extract(epoch from ((t::date + p_hf) - t)) / 60)::int;
    if resto <= disp then
      return (t + make_interval(mins => resto)) at time zone 'America/Sao_Paulo';
    end if;
    resto := resto - disp;
    t := (t::date + 1) + p_hi;
  end loop;
  return null;
end $fn$;

-- Prazos e situação de uma tarefa (base das duas funções abaixo). Sem checar acesso: só uso interno.
create or replace function public.gestao_sla_calcular(p_id_tarefa text)
returns table (id_tarefa text, meta_resposta int, meta_resolucao int, prazo_resposta timestamptz, respondido_em timestamptz,
               prazo_resolucao timestamptz, resolvido_em timestamptz, alerta_resolucao timestamptz)
language sql stable security definer set search_path = public as $fn$
  with t as (
    select t.id_tarefa, t.id_quadro, t.created_at, t.created_by, t.status, t.prioridade,
           c.metas, c.hora_inicio, c.hora_fim, c.dias
      from public.gestao_tarefas t
      join public.gestao_sla_quadros c on c.id_quadro = t.id_quadro and c.ativo and t.created_at >= c.vigente_desde
     where t.id_tarefa = p_id_tarefa and t.id_tarefa_pai is null
  ), m as (
    select t.*, (t.metas -> t.prioridade ->> 'resposta')::int as mr, (t.metas -> t.prioridade ->> 'resolucao')::int as ms,
           (select u.nome from public.usuarios u where lower(u.email) = lower(t.created_by)) as nome_criador
      from t
  )
  select m.id_tarefa, m.mr, m.ms,
         public.gestao_sla_somar(m.created_at, m.mr, m.hora_inicio, m.hora_fim, m.dias),
         least(
           (select min(h.created_at) from public.gestao_tarefa_historico h
             where h.id_tarefa = m.id_tarefa and h.tipo = 'status' and h.ator is not null
               and lower(h.ator) is distinct from lower(m.created_by)),
           (select min(cm.created_at) from public.gestao_comentarios cm
             where cm.id_tarefa = m.id_tarefa and cm.autor is not null
               and lower(cm.autor) is distinct from lower(coalesce(m.nome_criador, m.created_by)))
         ),
         public.gestao_sla_somar(m.created_at, m.ms, m.hora_inicio, m.hora_fim, m.dias),
         case when exists (select 1 from public.gestao_status s where s.id_quadro = m.id_quadro and s.slug = m.status and s.tipo = 'concluido')
              then (select max(h.created_at) from public.gestao_tarefa_historico h where h.id_tarefa = m.id_tarefa and h.tipo = 'status')
         end,
         public.gestao_sla_somar(m.created_at, (m.ms * 3) / 4, m.hora_inicio, m.hora_fim, m.dias)
    from m;
$fn$;
revoke all on function public.gestao_sla_calcular(text) from public, anon, authenticated;

-- Para a tela: prazos das tarefas de um quadro (quem vê o quadro) ou das OS que a pessoa pediu.
create or replace function public.gestao_sla_tarefas(p_id_quadro text, p_ids text[] default null)
returns table (id_tarefa text, meta_resposta int, meta_resolucao int, prazo_resposta timestamptz, respondido_em timestamptz,
               prazo_resolucao timestamptz, resolvido_em timestamptz, alerta_resolucao timestamptz)
language plpgsql stable security definer set search_path = public as $fn$
declare v_ve boolean := public.gestao_pode_ver(p_id_quadro);
begin
  if not exists (select 1 from public.gestao_sla_quadros c where c.id_quadro = p_id_quadro and c.ativo) then return; end if;
  return query
    select s.*
      from public.gestao_tarefas t
      cross join lateral public.gestao_sla_calcular(t.id_tarefa) s
     where t.id_quadro = p_id_quadro
       and (p_ids is null or t.id_tarefa = any(p_ids))
       and v_ve
       and public.gestao_ve_tarefa(t.id_tarefa)
       and t.created_at >= (select c.vigente_desde from public.gestao_sla_quadros c where c.id_quadro = p_id_quadro);
end $fn$;
revoke all on function public.gestao_sla_tarefas(text, text[]) from public, anon;
grant execute on function public.gestao_sla_tarefas(text, text[]) to authenticated;

-- Agendador (1/min, service role): avisa 75% da resolução e os estouros, uma vez cada.
create or replace function public.gestao_sla_avisar() returns int
  language plpgsql security definer set search_path = public as $fn$
declare r record; v_dest text[]; v_tipo text; v_titulo text; n int := 0; e text;
begin
  if not pg_try_advisory_xact_lock(hashtext('gestao_sla_avisar')) then return 0; end if;
  for r in
    select t.id_tarefa, t.id_quadro, t.titulo, s.*
      from public.gestao_tarefas t
      join public.gestao_sla_quadros c on c.id_quadro = t.id_quadro and c.ativo and t.created_at >= c.vigente_desde
      join public.gestao_status st on st.id_quadro = t.id_quadro and st.slug = t.status and st.tipo <> 'concluido'
      cross join lateral public.gestao_sla_calcular(t.id_tarefa) s
     where t.id_tarefa_pai is null
  loop
    v_tipo := null;
    if r.respondido_em is null and r.prazo_resposta is not null and now() >= r.prazo_resposta
       and not exists (select 1 from public.gestao_sla_avisos a where a.id_tarefa = r.id_tarefa and a.tipo = 'resposta_estourou') then
      v_tipo := 'resposta_estourou'; v_titulo := 'Passou do prazo da 1ª resposta: "' || r.titulo || '"';
    elsif r.prazo_resolucao is not null and now() >= r.prazo_resolucao
       and not exists (select 1 from public.gestao_sla_avisos a where a.id_tarefa = r.id_tarefa and a.tipo = 'resolucao_estourou') then
      v_tipo := 'resolucao_estourou'; v_titulo := 'Passou do prazo de resolução: "' || r.titulo || '"';
    elsif r.alerta_resolucao is not null and now() >= r.alerta_resolucao and now() < r.prazo_resolucao
       and not exists (select 1 from public.gestao_sla_avisos a where a.id_tarefa = r.id_tarefa and a.tipo = 'resolucao_75') then
      v_tipo := 'resolucao_75'; v_titulo := 'Prazo de resolução perto de vencer: "' || r.titulo || '"';
    end if;
    continue when v_tipo is null;
    insert into public.gestao_sla_avisos (id_tarefa, tipo) values (r.id_tarefa, v_tipo) on conflict do nothing;
    select coalesce(array_agg(distinct lower(v.usuario_email)), '{}') into v_dest
      from public.gestao_tarefa_vinculados v where v.id_tarefa = r.id_tarefa and v.tipo = 'responsavel';
    -- JCN: sem responsável, não avisa ninguém (no Painel ia à equipe T.I da Chabra).
    foreach e in array v_dest loop
      perform public.gestao_avisar(e, 'prazo_atendimento', v_titulo, r.id_tarefa, r.id_quadro, null);
    end loop;
    n := n + 1;
  end loop;
  return n;
end $fn$;
revoke all on function public.gestao_sla_avisar() from public, anon, authenticated;
grant execute on function public.gestao_sla_avisar() to service_role;
revoke all on function public.gestao_sla_somar(timestamptz, int, time, time, int[]) from public, anon;
grant execute on function public.gestao_sla_somar(timestamptz, int, time, time, int[]) to authenticated, service_role;

-- JCN: o prazo de atendimento não vem ligado em nenhum quadro (no Painel, nos quadros da OS da T.I).

-- ═══ 10. Comentário atribuído ═════════════════════════════════════════════════════════════════════════════════
alter table public.gestao_comentarios add column if not exists atribuido_a text;
alter table public.gestao_comentarios add column if not exists resolvido_em timestamptz;
alter table public.gestao_comentarios add column if not exists resolvido_por text;
create index if not exists idx_gestao_coment_atribuido on public.gestao_comentarios (lower(atribuido_a))
  where atribuido_a is not null and resolvido_em is null;

create or replace function public.gestao_aviso_comentario_atribuido_trg() returns trigger
  language plpgsql security definer set search_path = public as $fn$
declare v_t record;
begin
  if new.atribuido_a is null or (tg_op = 'UPDATE' and new.atribuido_a is not distinct from old.atribuido_a) then return null; end if;
  select titulo, id_quadro into v_t from public.gestao_tarefas where id_tarefa = new.id_tarefa;
  if not found then return null; end if;
  perform public.gestao_avisar(new.atribuido_a, 'comentario_atribuido', 'Comentário para você em "' || v_t.titulo || '"',
                               new.id_tarefa, v_t.id_quadro, public.gestao_email_ou_nulo());
  return null;
end $fn$;
drop trigger if exists gestao_aviso_comentario_atribuido on public.gestao_comentarios;
create trigger gestao_aviso_comentario_atribuido after insert or update of atribuido_a on public.gestao_comentarios
  for each row execute function public.gestao_aviso_comentario_atribuido_trg();

create or replace function public.gestao_comentario_resolver(p_id text, p_resolvido boolean) returns void
  language plpgsql security definer set search_path = public as $fn$
declare v record;
begin
  select c.atribuido_a, t.id_quadro, c.id_tarefa into v
    from public.gestao_comentarios c join public.gestao_tarefas t on t.id_tarefa = c.id_tarefa
   where c.id_comentario = p_id;
  if not found then raise exception 'Comentário não encontrado.'; end if;
  if v.atribuido_a is null then raise exception 'Este comentário não está atribuído a ninguém.'; end if;
  if not (lower(v.atribuido_a) = public.gestao_email() or public.gestao_pode_editar_q(v.id_quadro)) then
    raise exception 'Só quem recebeu o comentário ou quem edita o quadro pode resolver.' using errcode = '42501';
  end if;
  update public.gestao_comentarios
     set resolvido_em = case when p_resolvido then now() end,
         resolvido_por = case when p_resolvido then public.gestao_email() end
   where id_comentario = p_id;
end $fn$;
revoke all on function public.gestao_comentario_resolver(text, boolean) from public, anon;
grant execute on function public.gestao_comentario_resolver(text, boolean) to authenticated;
revoke all on function public.gestao_aviso_comentario_atribuido_trg() from public, anon, authenticated;


notify pgrst, 'reload schema';

commit;
