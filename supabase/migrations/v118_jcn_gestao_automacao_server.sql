-- v120 — Gestão Chabra: Fase A — motor de automação SERVER-SIDE + gatilhos por tempo.
--
-- Antes: automações rodavam 100% no navegador (useAutomacaoRunner) — só disparavam com
-- alguém no quadro; `prazo_proximo` nunca executava. Agora o motor vive no Postgres:
--   • Eventos (status muda / tarefa criada): trigger AFTER em gestao_tarefas → executor.
--   • Tempo (prazo próximo / vencido): função varrida pelo pg_cron (diário).
--   • As 5 ações atuais seguem iguais (mover status, responsável, prioridade, campo, notificar).
--
-- Aditivo/reversível: gestao_automacoes fica intacta (modelo rico = Fase B). O runner client-side
-- é aposentado no código (senão a ação roda 2x). Guarda de recursão via GUC (sem cascatear).

-- ── 1) Log de execução (observabilidade + dedup dos gatilhos por tempo) ───────
create table if not exists public.gestao_automacao_log (
  id uuid primary key default gen_random_uuid(),
  id_automacao uuid references public.gestao_automacoes(id) on delete set null,
  id_tarefa text,
  gatilho text not null,
  resultado text not null default 'ok',   -- ok | skip | erro
  detalhe text,
  created_at timestamptz not null default now()
);
create index if not exists idx_gestao_autom_log_tarefa on public.gestao_automacao_log (id_tarefa, gatilho);
create index if not exists idx_gestao_autom_log_autom on public.gestao_automacao_log (id_automacao);

alter table public.gestao_automacao_log enable row level security;
drop policy if exists gestao_autom_log_sel on public.gestao_automacao_log;
create policy gestao_autom_log_sel on public.gestao_automacao_log for select to authenticated using (true);
-- sem policy de escrita: só as funções SECURITY DEFINER inserem.

-- ── 2) Aplicador de UMA ação (reusado por evento e por tempo) ─────────────────
-- Guarda de recursão: marca 'gestao.in_automacao'=on para que os UPDATEs feitos aqui NÃO
-- re-disparem o trigger. is_local=true → limitado à transação.
create or replace function public.gestao_automacao_aplicar(
  p_autom public.gestao_automacoes, p_tarefa public.gestao_tarefas, p_gatilho text
) returns void language plpgsql security definer set search_path=public as $fn$
declare
  v_acao jsonb := coalesce(p_autom.acao, '{}'::jsonb);
  v_tipo text := v_acao->>'tipo';
  v_email text; v_res text := 'ok'; v_det text := null;
begin
  begin
    if v_tipo = 'mover_status' and coalesce(v_acao->>'valor','') <> '' then
      update public.gestao_tarefas set status = v_acao->>'valor', updated_at = now() where id_tarefa = p_tarefa.id_tarefa;
    elsif v_tipo = 'definir_responsavel' then
      update public.gestao_tarefas set responsavel = nullif(v_acao->>'valor',''), updated_at = now() where id_tarefa = p_tarefa.id_tarefa;
    elsif v_tipo = 'definir_prioridade' and coalesce(v_acao->>'valor','') <> '' then
      update public.gestao_tarefas set prioridade = v_acao->>'valor', updated_at = now() where id_tarefa = p_tarefa.id_tarefa;
    elsif v_tipo = 'definir_campo' and coalesce(v_acao->>'campo_id','') <> '' then
      update public.gestao_tarefas
        set campos = jsonb_set(coalesce(campos,'{}'::jsonb), array[v_acao->>'campo_id'], coalesce(to_jsonb(v_acao->>'valor'), 'null'::jsonb)),
            updated_at = now()
        where id_tarefa = p_tarefa.id_tarefa;
    elsif v_tipo = 'notificar' then
      select email into v_email from public.usuarios where nome = p_tarefa.responsavel limit 1;
      if v_email is null then
        v_res := 'skip'; v_det := 'sem responsável/e-mail';
      elsif p_gatilho like 'prazo%' and exists (
        select 1 from public.gestao_notificacoes n
        where n.id_tarefa = p_tarefa.id_tarefa and n.tipo = 'prazo' and n.created_at::date = current_date
      ) then
        v_res := 'skip'; v_det := 'notificação de prazo já enviada hoje';
      else
        insert into public.gestao_notificacoes (id, destinatario, tipo, titulo, id_tarefa, id_quadro)
        values (gen_random_uuid(), v_email,
                case when p_gatilho like 'prazo%' then 'prazo' else 'status' end,
                coalesce(nullif(v_acao->>'valor',''), 'Automação: ' || p_tarefa.titulo),
                p_tarefa.id_tarefa, p_tarefa.id_quadro);
      end if;
    else
      v_res := 'skip'; v_det := 'ação não reconhecida: ' || coalesce(v_tipo,'(vazia)');
    end if;
  exception when others then
    v_res := 'erro'; v_det := left(SQLERRM, 300);
  end;

  insert into public.gestao_automacao_log (id_automacao, id_tarefa, gatilho, resultado, detalhe)
    values (p_autom.id, p_tarefa.id_tarefa, p_gatilho, v_res, v_det);
end $fn$;

-- ── 3) Executor de EVENTO (status_muda / tarefa_criada) ──────────────────────
create or replace function public.gestao_automacao_run(
  p_id_tarefa text, p_gatilho text, p_de text, p_para text
) returns void language plpgsql security definer set search_path=public as $fn$
declare v_tarefa public.gestao_tarefas; a public.gestao_automacoes;
begin
  select * into v_tarefa from public.gestao_tarefas where id_tarefa = p_id_tarefa;
  if not found then return; end if;

  perform set_config('gestao.in_automacao', 'on', true);   -- não re-disparar via ações
  for a in
    select * from public.gestao_automacoes
    where id_quadro = v_tarefa.id_quadro and ativo and gatilho = p_gatilho
    order by ordem
  loop
    if p_gatilho = 'status_muda' then
      if (a.condicao->>'de')   is not null and a.condicao->>'de'   <> coalesce(p_de,'')   then continue; end if;
      if (a.condicao->>'para') is not null and a.condicao->>'para' <> coalesce(p_para,'') then continue; end if;
    end if;
    perform public.gestao_automacao_aplicar(a, v_tarefa, p_gatilho);
    select * into v_tarefa from public.gestao_tarefas where id_tarefa = p_id_tarefa;  -- reflete mudanças
  end loop;
  perform set_config('gestao.in_automacao', 'off', true);
end $fn$;

-- ── 4) Trigger em gestao_tarefas (evento) ────────────────────────────────────
create or replace function public.gestao_automacao_trg() returns trigger
  language plpgsql security definer set search_path=public as $fn$
begin
  if coalesce(current_setting('gestao.in_automacao', true), '') = 'on' then return null; end if;  -- ação de automação: não recursa
  begin
    if tg_op = 'INSERT' then
      perform public.gestao_automacao_run(new.id_tarefa, 'tarefa_criada', null, null);
    elsif tg_op = 'UPDATE' then
      perform public.gestao_automacao_run(new.id_tarefa, 'status_muda', old.status, new.status);
    end if;
  exception when others then
    perform set_config('gestao.in_automacao', 'off', true);
    insert into public.gestao_automacao_log (id_tarefa, gatilho, resultado, detalhe)
      values (new.id_tarefa, tg_op, 'erro', left(SQLERRM, 300));  -- nunca falha o save do usuário
  end;
  return null;
end $fn$;

drop trigger if exists trg_gestao_automacao_ins on public.gestao_tarefas;
create trigger trg_gestao_automacao_ins after insert on public.gestao_tarefas
  for each row execute function public.gestao_automacao_trg();

drop trigger if exists trg_gestao_automacao_upd on public.gestao_tarefas;
create trigger trg_gestao_automacao_upd after update on public.gestao_tarefas
  for each row when (old.status is distinct from new.status) execute function public.gestao_automacao_trg();

-- ── 5) Executor por TEMPO (prazo_proximo com dias_antes / prazo_vencido) ──────
create or replace function public.gestao_automacao_prazos() returns void
  language plpgsql security definer set search_path=public as $fn$
declare a public.gestao_automacoes; t public.gestao_tarefas; v_dias int;
begin
  perform set_config('gestao.in_automacao', 'on', true);
  for a in
    select * from public.gestao_automacoes
    where ativo and gatilho in ('prazo_proximo','prazo_vencido')
    order by ordem
  loop
    v_dias := coalesce((a.condicao->>'dias_antes')::int, 3);
    for t in
      select tk.* from public.gestao_tarefas tk
      left join public.gestao_status s on s.id_quadro = tk.id_quadro and s.slug = tk.status
      where tk.id_quadro = a.id_quadro
        and tk.prazo is not null
        and coalesce(s.tipo, 'ativo') <> 'concluido'
        and (
          (a.gatilho = 'prazo_proximo' and current_date >= (tk.prazo - v_dias) and current_date <= tk.prazo)
          or (a.gatilho = 'prazo_vencido' and tk.prazo < current_date)
        )
        -- dedup: cada automação dispara uma vez por tarefa
        and not exists (
          select 1 from public.gestao_automacao_log l
          where l.id_automacao = a.id and l.id_tarefa = tk.id_tarefa and l.gatilho = a.gatilho and l.resultado <> 'erro'
        )
    loop
      perform public.gestao_automacao_aplicar(a, t, a.gatilho);
    end loop;
  end loop;
  perform set_config('gestao.in_automacao', 'off', true);
end $fn$;

-- ── 6) Agendamento diário — SÓ se o pg_cron existir ──────────────────────────
-- Supabase tem pg_cron; o self-host .107 (banco painel_sst) NÃO tem o schema `cron`.
-- Guardado para a migration aplicar nos dois ambientes. Sem pg_cron, os prazos rodam
-- pelo fallback abaixo (gestao_automacao_tick), disparado pelo app ao abrir a Gestão.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('gestao-automacao-prazos', '15 6 * * *', $c$select public.gestao_automacao_prazos()$c$);
  else
    raise notice 'pg_cron indisponível: agendamento não criado. Prazos rodam via gestao_automacao_tick().';
  end if;
end $$;

-- ── 7) Fallback sem pg_cron: tick idempotente (1x/dia), chamado pelo app ─────
-- Roda o scan de prazos no máximo uma vez por dia (marca 'tick' no log). Seguro sob
-- concorrência: o dedup interno de gestao_automacao_prazos evita ação/aviso em dobro.
create or replace function public.gestao_automacao_tick() returns void
  language plpgsql security definer set search_path=public as $fn$
begin
  if exists (select 1 from public.gestao_automacao_log where gatilho = 'tick' and created_at::date = current_date) then
    return;  -- já rodou hoje
  end if;
  insert into public.gestao_automacao_log (gatilho, resultado, detalhe) values ('tick', 'ok', 'scan diário de prazos');
  perform public.gestao_automacao_prazos();
end $fn$;
