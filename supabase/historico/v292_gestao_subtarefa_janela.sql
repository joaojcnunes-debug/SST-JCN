-- v292 (JCN) — Gestão: subtarefa abre a janela completa da tarefa
-- Replicado do Painel SST (v300, v0.3.779), sem a trava de banco do painel, sem owner chabra_admin
-- e sem schema_migrations.
--
-- REAPLICAR: idempotente. ROLLBACK: scripts/sql/v292_*_rollback.sql

-- v300 — subtarefa abre a janela completa da tarefa (duplo clique).
--
-- A subtarefa continua sendo uma linha de gestao_subtarefas (lista, modelos, automações e o
-- espelho jsonb seguem iguais). No PRIMEIRO duplo clique a RPC gestao_subtarefa_abrir cria uma
-- tarefa "filha" em gestao_tarefas (id_tarefa_pai = tarefa-mãe, mesmo quadro/unidade) e liga as
-- duas (gestao_subtarefas.id_tarefa_filha). Daí em diante a filha tem tudo da tarefa: descrição,
-- datas/horas, prioridade, status, responsáveis/seguidores, comentários, anexos, histórico e
-- Google Agenda. Nada é convertido em massa: só a subtarefa aberta ganha a filha.
--
-- Sincronia (gatilhos, com a guarda gestao.sync_sub contra laço):
--   lista → filha: texto → título; feito → status (concluído / volta a não iniciado); responsável → vínculo.
--   filha → lista: título → texto; status concluído → feito (dispara 'subtarefa_concluida' na mãe,
--                  igual marcar na lista); 1º responsável → responsável da linha.
--   apagar a linha apaga a filha; apagar a filha apaga a linha (FK cascade); apagar a mãe apaga as duas.
--   mãe muda de quadro → as filhas vão junto.
-- A filha NÃO aparece no quadro/listas/Meu Espaço/ICS (filtro id_tarefa_pai is null no app), não roda
-- automações do quadro nem gera "Nova tarefa no quadro". Avisos de prazo e o Google Agenda valem.
--
-- Aditiva. Rollback: ver o fim do arquivo.

alter table public.gestao_tarefas
  add column if not exists id_tarefa_pai text references public.gestao_tarefas(id_tarefa) on delete cascade;
create index if not exists gestao_tarefas_pai_idx on public.gestao_tarefas (id_tarefa_pai) where id_tarefa_pai is not null;

alter table public.gestao_subtarefas
  add column if not exists id_tarefa_filha text references public.gestao_tarefas(id_tarefa) on delete cascade;
create unique index if not exists gestao_subtarefas_filha_uq on public.gestao_subtarefas (id_tarefa_filha) where id_tarefa_filha is not null;

-- ── Status equivalente ao "feito" da linha, no quadro ─────────────────────────────────────────
-- feito → 1º status 'concluido'. Não feito → mantém p_atual se já não é concluído; senão o 1º
-- 'nao_iniciado' (ou o 1º não concluído).
create or replace function public.gestao_status_para_feito(p_id_quadro text, p_feito boolean, p_atual text default null)
returns text language sql stable security definer set search_path=public as $fn$
  select case
    when p_feito then coalesce(
      (select slug from public.gestao_status where id_quadro = p_id_quadro and tipo = 'concluido' order by ordem limit 1),
      p_atual)
    when p_atual is not null and exists (
      select 1 from public.gestao_status where id_quadro = p_id_quadro and slug = p_atual and tipo <> 'concluido')
      then p_atual
    else coalesce(
      (select slug from public.gestao_status where id_quadro = p_id_quadro and tipo <> 'concluido'
        order by (tipo = 'nao_iniciado') desc, ordem limit 1),
      'A_FAZER')
  end
$fn$;
revoke all on function public.gestao_status_para_feito(text, boolean, text) from public, anon, authenticated;

-- ── RPC: abre (cria na 1ª vez) a tarefa filha de uma subtarefa ────────────────────────────────
create or replace function public.gestao_subtarefa_abrir(p_id_subtarefa text) returns text
  language plpgsql security definer set search_path=public as $fn$
declare s record; v_pai record; v_id text;
begin
  select * into s from public.gestao_subtarefas where id = p_id_subtarefa for update;
  if not found then
    raise exception 'Subtarefa não encontrada.' using errcode = 'P0002';
  end if;
  select id_tarefa, id_quadro, id_unidade into v_pai from public.gestao_tarefas where id_tarefa = s.id_tarefa;
  -- Mesma régua da leitura (RLS de gestao_tarefas): só quem vê a tarefa-mãe abre a subtarefa.
  if not (public.gestao_pode_ver(v_pai.id_quadro) and public.gestao_ve_tarefa(v_pai.id_tarefa)) then
    raise exception 'Sem acesso a esta tarefa.' using errcode = '42501';
  end if;
  if s.id_tarefa_filha is not null then
    return s.id_tarefa_filha;
  end if;

  v_id := 'TRF-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));
  perform set_config('gestao.sync_sub', 'on', true);
  insert into public.gestao_tarefas (id_tarefa, id_quadro, titulo, status, id_tarefa_pai, id_unidade, created_by, created_at, updated_at)
  values (v_id, v_pai.id_quadro, s.texto, public.gestao_status_para_feito(v_pai.id_quadro, s.feito),
          v_pai.id_tarefa, v_pai.id_unidade, public.gestao_email(), now(), now());
  if s.responsavel_email is not null then
    insert into public.gestao_tarefa_vinculados (id_tarefa, usuario_email, tipo, origem)
    values (v_id, lower(s.responsavel_email), 'responsavel', 'subtarefa')
    on conflict do nothing;
  end if;
  update public.gestao_subtarefas set id_tarefa_filha = v_id where id = s.id;
  perform set_config('gestao.sync_sub', '', true);
  return v_id;
end $fn$;
revoke all on function public.gestao_subtarefa_abrir(text) from public, anon;
grant execute on function public.gestao_subtarefa_abrir(text) to authenticated, service_role;

-- ── Lista → filha ─────────────────────────────────────────────────────────────────────────────
create or replace function public.gestao_subtarefa_sync_filha_trg() returns trigger
  language plpgsql security definer set search_path=public as $fn$
declare v_t record;
begin
  if coalesce(current_setting('gestao.sync_sub', true), '') = 'on' then return null; end if;
  if tg_op = 'DELETE' then
    perform set_config('gestao.sync_sub', 'on', true);
    delete from public.gestao_tarefas where id_tarefa = old.id_tarefa_filha;
    perform set_config('gestao.sync_sub', '', true);
    return null;
  end if;
  if new.texto is not distinct from old.texto
     and new.feito is not distinct from old.feito
     and new.responsavel_email is not distinct from old.responsavel_email then
    return null;
  end if;
  select id_quadro, status into v_t from public.gestao_tarefas where id_tarefa = new.id_tarefa_filha;
  if not found then return null; end if;

  perform set_config('gestao.sync_sub', 'on', true);
  update public.gestao_tarefas
     set titulo = case when new.texto is distinct from old.texto then new.texto else titulo end,
         status = case when new.feito is distinct from old.feito
                       then public.gestao_status_para_feito(v_t.id_quadro, new.feito, v_t.status) else status end,
         updated_at = now()
   where id_tarefa = new.id_tarefa_filha;
  if new.responsavel_email is distinct from old.responsavel_email then
    delete from public.gestao_tarefa_vinculados where id_tarefa = new.id_tarefa_filha and tipo = 'responsavel';
    if new.responsavel_email is not null then
      insert into public.gestao_tarefa_vinculados (id_tarefa, usuario_email, tipo, origem)
      values (new.id_tarefa_filha, lower(new.responsavel_email), 'responsavel', 'subtarefa')
      on conflict do nothing;
    end if;
  end if;
  perform set_config('gestao.sync_sub', '', true);
  return null;
end $fn$;
revoke all on function public.gestao_subtarefa_sync_filha_trg() from public, anon, authenticated;

drop trigger if exists gestao_subtarefa_sync_filha_upd on public.gestao_subtarefas;
create trigger gestao_subtarefa_sync_filha_upd
  after update on public.gestao_subtarefas
  for each row when (new.id_tarefa_filha is not null)
  execute function public.gestao_subtarefa_sync_filha_trg();
drop trigger if exists gestao_subtarefa_sync_filha_del on public.gestao_subtarefas;
create trigger gestao_subtarefa_sync_filha_del
  after delete on public.gestao_subtarefas
  for each row when (old.id_tarefa_filha is not null)
  execute function public.gestao_subtarefa_sync_filha_trg();

-- ── Filha → lista (e mãe muda de quadro → filhas vão junto) ───────────────────────────────────
create or replace function public.gestao_tarefa_sync_subtarefa_trg() returns trigger
  language plpgsql security definer set search_path=public as $fn$
declare v_feito boolean;
begin
  if coalesce(current_setting('gestao.sync_sub', true), '') = 'on' then return null; end if;

  if new.id_tarefa_pai is null then
    if new.id_quadro is distinct from old.id_quadro then
      perform set_config('gestao.sync_sub', 'on', true);
      update public.gestao_tarefas f
         set id_quadro = new.id_quadro,
             id_unidade = new.id_unidade,
             status = public.gestao_status_para_feito(new.id_quadro, coalesce(s.feito, false)),
             updated_at = now()
        from public.gestao_subtarefas s
       where f.id_tarefa_pai = new.id_tarefa and s.id_tarefa_filha = f.id_tarefa;
      perform set_config('gestao.sync_sub', '', true);
    end if;
    return null;
  end if;

  if new.titulo is not distinct from old.titulo and new.status is not distinct from old.status then
    return null;
  end if;
  v_feito := exists (select 1 from public.gestao_status
                      where id_quadro = new.id_quadro and slug = new.status and tipo = 'concluido');
  perform set_config('gestao.sync_sub', 'on', true);
  update public.gestao_subtarefas
     set texto = new.titulo, feito = v_feito
   where id_tarefa_filha = new.id_tarefa
     and (texto is distinct from new.titulo or feito is distinct from v_feito);
  perform set_config('gestao.sync_sub', '', true);
  return null;
end $fn$;
revoke all on function public.gestao_tarefa_sync_subtarefa_trg() from public, anon, authenticated;

drop trigger if exists gestao_tarefa_sync_subtarefa_trg on public.gestao_tarefas;
create trigger gestao_tarefa_sync_subtarefa_trg
  after update on public.gestao_tarefas
  for each row execute function public.gestao_tarefa_sync_subtarefa_trg();

-- Responsáveis da filha → responsável da linha (o 1º, por ordem de vínculo).
create or replace function public.gestao_vinculo_sync_subtarefa_trg() returns trigger
  language plpgsql security definer set search_path=public as $fn$
declare v_id text; v_resp text;
begin
  if coalesce(current_setting('gestao.sync_sub', true), '') = 'on' then return null; end if;
  if tg_op = 'DELETE' then v_id := old.id_tarefa; if old.tipo <> 'responsavel' then return null; end if;
  else v_id := new.id_tarefa; if new.tipo <> 'responsavel' then return null; end if;
  end if;
  if not exists (select 1 from public.gestao_subtarefas where id_tarefa_filha = v_id) then return null; end if;
  select usuario_email into v_resp from public.gestao_tarefa_vinculados
   where id_tarefa = v_id and tipo = 'responsavel' order by created_at, usuario_email limit 1;
  perform set_config('gestao.sync_sub', 'on', true);
  update public.gestao_subtarefas set responsavel_email = v_resp
   where id_tarefa_filha = v_id and responsavel_email is distinct from v_resp;
  perform set_config('gestao.sync_sub', '', true);
  return null;
end $fn$;
revoke all on function public.gestao_vinculo_sync_subtarefa_trg() from public, anon, authenticated;

drop trigger if exists gestao_vinculo_sync_subtarefa_trg on public.gestao_tarefa_vinculados;
create trigger gestao_vinculo_sync_subtarefa_trg
  after insert or delete on public.gestao_tarefa_vinculados
  for each row execute function public.gestao_vinculo_sync_subtarefa_trg();

-- ── Funções existentes: só a regra da filha acrescentada (corpo atual de produção) ─────────────
CREATE OR REPLACE FUNCTION public.gestao_ve_tarefa(p_id_tarefa text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text;
  v_papel public.gestao_papel;
begin
  -- 1) sem e-mail no JWT -> nao ve
  v_email := public.gestao_email();
  if v_email is null then
    return false;
  end if;

  -- 2) gestor global (owner/admin; perfil=Admin vira owner) ve TODAS
  v_papel := public.gestao_papel_de(v_email);
  if v_papel in ('owner','admin') then
    return true;
  end if;

  -- 3) nao-membro (papel nulo) nao ve
  if v_papel is null then
    return false;
  end if;

  -- 4) gestor DO quadro/espaco da tarefa: nivel herdado 'full' (>=4). Membro de quadro
  --    ABERTO resolve 'edit' (3) e NAO passa aqui — e exatamente o ponto do flip.
  --    v294: e a unidade da tarefa precisa estar entre as do membro (sem unidades = todas).
  if public.gestao_nivel_ord(
       public.gestao_resolver_nivel(v_email, 'task'::public.gestao_recurso, p_id_tarefa)
     ) >= 4
     and public.gestao_unidade_ok(v_email, p_id_tarefa) then
    return true;
  end if;

  -- 4b) v235: supervisor de equipe ve as tarefas do MEU QUADRO dos membros que supervisiona
  --     (restrito a quadros com dono_email; NAO generaliza "edit ve tudo").
  if exists (
       select 1 from public.gestao_tarefas t
       join public.gestao_quadros q on q.id_quadro = t.id_quadro
       where t.id_tarefa = p_id_tarefa
         and q.dono_email is not null
         and coalesce(public.gestao_supervisiona(v_email, q.dono_email), false)
     ) then
    return true;
  end if;

  -- 5) grant explicito NAO-restritivo na PROPRIA tarefa (view/comment/edit/full)
  if exists (
       select 1 from public.gestao_acessos a
       where a.recurso_tipo = 'task'::public.gestao_recurso
         and a.recurso_id = p_id_tarefa
         and coalesce(a.restritivo, false) = false
         and lower(a.usuario_email) = v_email
     ) then
    return true;
  end if;

  -- 6) vinculado (responsavel ou seguidor) a tarefa
  if exists (
       select 1 from public.gestao_tarefa_vinculados v
       where v.id_tarefa = p_id_tarefa
         and lower(v.usuario_email) = v_email
     ) then
    return true;
  end if;

  -- 7) criador da tarefa (created_by = e-mail do caller)
  if exists (
       select 1 from public.gestao_tarefas t
       where t.id_tarefa = p_id_tarefa
         and lower(t.created_by) = v_email
     ) then
    return true;
  end if;

  -- 7.5) responsavel de alguma subtarefa desta tarefa (alocar subtarefa -> ve a tarefa-mae)
  if exists (
       select 1 from public.gestao_subtarefas s
       where s.id_tarefa = p_id_tarefa
         and lower(s.responsavel_email) = v_email
     ) then
    return true;
  end if;

  -- 7.6) v300: subtarefa aberta como tarefa (id_tarefa_pai) -> quem ve a tarefa-mae ve a filha
  if exists (
       select 1 from public.gestao_tarefas t
       where t.id_tarefa = p_id_tarefa
         and t.id_tarefa_pai is not null
         and public.gestao_ve_tarefa(t.id_tarefa_pai)
     ) then
    return true;
  end if;

  -- 8) senao, nao ve
  return false;
end
$function$;

CREATE OR REPLACE FUNCTION public.gestao_automacao_trg()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- v300: subtarefa aberta como tarefa nao roda as automacoes do quadro (a lista ja roda as dela).
  if new.id_tarefa_pai is not null then return null; end if;
  begin
    if tg_op = 'INSERT' then
      perform public.gestao_automacao_run(new.id_tarefa, 'tarefa_criada', null, null);
    elsif tg_op = 'UPDATE' then
      if old.id_quadro is distinct from new.id_quadro then
        perform public.gestao_automacao_run(new.id_tarefa, 'tarefa_movida_quadro', old.id_quadro, new.id_quadro);
      end if;
      if old.status is distinct from new.status then
        perform public.gestao_automacao_run(new.id_tarefa, 'status_muda', old.status, new.status);
      end if;
    end if;
  exception when others then
    perform set_config('gestao.autom_depth', '0', true);
    insert into public.gestao_automacao_log (id_tarefa, gatilho, resultado, detalhe)
      values (new.id_tarefa, tg_op, 'erro', left(SQLERRM, 300));  -- nunca falha o save do usuário
  end;
  return null;
end
$function$;

CREATE OR REPLACE FUNCTION public.gestao_automacao_prazos()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.gestao_automacoes; t public.gestao_tarefas; v_dias int; v_depth int;
begin
  v_depth := coalesce(nullif(current_setting('gestao.autom_depth', true), ''), '0')::int;
  perform set_config('gestao.autom_depth', (v_depth + 1)::text, true);
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
        and tk.id_tarefa_pai is null  -- v300: subtarefa aberta como tarefa fica fora
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
  perform set_config('gestao.autom_depth', v_depth::text, true);
exception when others then
  perform set_config('gestao.autom_depth', coalesce(v_depth, 0)::text, true);
end
$function$;

CREATE OR REPLACE FUNCTION public.gestao_aviso_quadro_trg()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_t record; v_q record; v_ator text := public.gestao_email(); r record;
BEGIN
  SELECT id_tarefa, id_quadro, titulo, id_tarefa_pai INTO v_t FROM public.gestao_tarefas WHERE id_tarefa = new.id_tarefa;
  IF NOT FOUND THEN RETURN null; END IF;                       -- apagada antes do fim da transação
  IF v_t.id_tarefa_pai IS NOT NULL THEN RETURN null; END IF;   -- v300: subtarefa aberta como tarefa
  SELECT id_quadro, nome, id_pasta, id_espaco, dono_email INTO v_q FROM public.gestao_quadros WHERE id_quadro = v_t.id_quadro;
  IF NOT FOUND OR v_q.dono_email IS NOT NULL THEN RETURN null; END IF;   -- Meu Quadro: sem aviso

  FOR r IN
    WITH g AS (
      SELECT a.usuario_email, a.id_equipe FROM public.gestao_acessos a
       WHERE (a.recurso_tipo = 'list'   AND a.recurso_id = v_q.id_quadro)
          OR (a.recurso_tipo = 'folder' AND a.recurso_id = v_q.id_pasta::text)
          OR (a.recurso_tipo = 'space'  AND a.recurso_id = v_q.id_espaco::text)
    )
    SELECT DISTINCT lower(e) AS email FROM (
      SELECT g.usuario_email AS e FROM g WHERE g.usuario_email IS NOT NULL
      UNION ALL
      SELECT m.usuario_email FROM g JOIN public.gestao_equipe_membros m ON m.id_equipe = g.id_equipe
        JOIN public.gestao_equipes eq ON eq.id = m.id_equipe AND eq.ativo
    ) x
  LOOP
    -- Só quem vê TODAS as tarefas do quadro (nível total) e a unidade da tarefa; vinculado já é avisado.
    IF public.gestao_resolver_nivel(r.email, 'task', v_t.id_tarefa) = 'full'
       AND public.gestao_unidade_ok(r.email, v_t.id_tarefa)
       AND NOT EXISTS (SELECT 1 FROM public.gestao_tarefa_vinculados v WHERE v.id_tarefa = v_t.id_tarefa AND lower(v.usuario_email) = r.email) THEN
      PERFORM public.gestao_avisar(r.email, 'quadro', 'Nova tarefa em ' || v_q.nome || ': ' || v_t.titulo, v_t.id_tarefa, v_q.id_quadro, v_ator);
    END IF;
  END LOOP;
  RETURN null;
END $function$;

CREATE OR REPLACE FUNCTION public.gestao_aviso_vinculo_trg()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_t record;
BEGIN
  -- v300: vínculo espelhado da subtarefa (abrir / trocar responsável na lista) não gera aviso.
  IF coalesce(current_setting('gestao.sync_sub', true), '') = 'on' THEN RETURN null; END IF;
  SELECT titulo, id_quadro INTO v_t FROM public.gestao_tarefas WHERE id_tarefa = new.id_tarefa;
  IF NOT FOUND THEN RETURN null; END IF;
  PERFORM public.gestao_avisar(
    new.usuario_email,
    CASE WHEN new.tipo = 'responsavel' THEN 'atribuicao' ELSE 'seguidor' END,
    CASE WHEN new.tipo = 'responsavel' THEN 'Você foi atribuído à tarefa: ' ELSE 'Você agora segue a tarefa: ' END || v_t.titulo,
    new.id_tarefa, v_t.id_quadro, public.gestao_email());
  RETURN null;
END $function$;

notify pgrst, 'reload schema';

-- Rollback (nesta ordem):
--   reaplicar as 5 funções acima sem as linhas marcadas "v300" (corpo anterior no backup);
--   drop trigger gestao_vinculo_sync_subtarefa_trg on public.gestao_tarefa_vinculados;
--   drop trigger gestao_tarefa_sync_subtarefa_trg on public.gestao_tarefas;
--   drop trigger gestao_subtarefa_sync_filha_upd on public.gestao_subtarefas;
--   drop trigger gestao_subtarefa_sync_filha_del on public.gestao_subtarefas;
--   drop function public.gestao_vinculo_sync_subtarefa_trg(), public.gestao_tarefa_sync_subtarefa_trg(),
--     public.gestao_subtarefa_sync_filha_trg(), public.gestao_subtarefa_abrir(text),
--     public.gestao_status_para_feito(text, boolean, text);
--   delete from public.gestao_tarefas where id_tarefa_pai is not null;
--   alter table public.gestao_subtarefas drop column id_tarefa_filha;
--   alter table public.gestao_tarefas drop column id_tarefa_pai;
