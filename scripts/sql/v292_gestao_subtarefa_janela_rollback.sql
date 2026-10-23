-- ROLLBACK da v292 (JCN). As tarefas filhas (id_tarefa_pai) são APAGADAS; as linhas de subtarefa ficam.
-- Rodar no SQL editor do Supabase (uma transação).

-- Funções de antes (v289 / v290 / v291 / JCN):
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

CREATE OR REPLACE FUNCTION public.gestao_aviso_quadro_trg() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t record; v_q record; v_ator text := public.gestao_email(); r record;
BEGIN
  SELECT id_tarefa, id_quadro, titulo INTO v_t FROM public.gestao_tarefas WHERE id_tarefa = new.id_tarefa;
  IF NOT FOUND THEN RETURN null; END IF;                       -- apagada antes do fim da transação
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
END $$;

CREATE OR REPLACE FUNCTION public.gestao_aviso_vinculo_trg() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t record;
BEGIN
  SELECT titulo, id_quadro INTO v_t FROM public.gestao_tarefas WHERE id_tarefa = new.id_tarefa;
  IF NOT FOUND THEN RETURN null; END IF;
  PERFORM public.gestao_avisar(
    new.usuario_email,
    CASE WHEN new.tipo = 'responsavel' THEN 'atribuicao' ELSE 'seguidor' END,
    CASE WHEN new.tipo = 'responsavel' THEN 'Você foi atribuído à tarefa: ' ELSE 'Você agora segue a tarefa: ' END || v_t.titulo,
    new.id_tarefa, v_t.id_quadro, public.gestao_email());
  RETURN null;
END $$;

DROP TRIGGER IF EXISTS gestao_vinculo_sync_subtarefa_trg ON public.gestao_tarefa_vinculados;
DROP TRIGGER IF EXISTS gestao_tarefa_sync_subtarefa_trg ON public.gestao_tarefas;
DROP TRIGGER IF EXISTS gestao_subtarefa_sync_filha_upd ON public.gestao_subtarefas;
DROP TRIGGER IF EXISTS gestao_subtarefa_sync_filha_del ON public.gestao_subtarefas;
DROP FUNCTION IF EXISTS public.gestao_vinculo_sync_subtarefa_trg();
DROP FUNCTION IF EXISTS public.gestao_tarefa_sync_subtarefa_trg();
DROP FUNCTION IF EXISTS public.gestao_subtarefa_sync_filha_trg();
DROP FUNCTION IF EXISTS public.gestao_subtarefa_abrir(text);
DROP FUNCTION IF EXISTS public.gestao_status_para_feito(text, boolean, text);
UPDATE public.gestao_subtarefas SET id_tarefa_filha = NULL WHERE id_tarefa_filha IS NOT NULL;
DELETE FROM public.gestao_tarefas WHERE id_tarefa_pai IS NOT NULL;
ALTER TABLE public.gestao_subtarefas DROP COLUMN IF EXISTS id_tarefa_filha;
ALTER TABLE public.gestao_tarefas DROP COLUMN IF EXISTS id_tarefa_pai;

NOTIFY pgrst, 'reload schema';
