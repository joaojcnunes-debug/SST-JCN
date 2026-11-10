-- Rollback da v335 — os dois gatilhos de aviso voltam como estavam e saem a tabela e as RPCs das notificações por
-- coluna. Os avisos 'etapa' já entregues ficam no sino.
begin;

CREATE OR REPLACE FUNCTION public.gestao_aviso_status_trg()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_nome text; v_ator text := public.gestao_email(); r record;
BEGIN
  SELECT s.nome INTO v_nome FROM public.gestao_status s WHERE s.id_quadro = new.id_quadro AND s.slug = new.status;
  FOR r IN SELECT DISTINCT usuario_email FROM public.gestao_tarefa_vinculados WHERE id_tarefa = new.id_tarefa LOOP
    PERFORM public.gestao_avisar(r.usuario_email, 'status',
      '"' || new.titulo || '" mudou para ' || coalesce(v_nome, new.status), new.id_tarefa, new.id_quadro, v_ator);
  END LOOP;
  RETURN null;
END $function$;

CREATE OR REPLACE FUNCTION public.gestao_aviso_quadro_trg()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_t record; v_q record; v_ator text := public.gestao_email(); r record;
BEGIN
  SELECT id_tarefa, id_quadro, titulo, id_tarefa_pai INTO v_t FROM public.gestao_tarefas WHERE id_tarefa = new.id_tarefa;
  IF NOT FOUND THEN RETURN null; END IF;
  IF v_t.id_tarefa_pai IS NOT NULL THEN RETURN null; END IF;   -- v300
  SELECT id_quadro, nome, id_pasta, id_espaco, dono_email INTO v_q FROM public.gestao_quadros WHERE id_quadro = v_t.id_quadro;
  IF NOT FOUND OR v_q.dono_email IS NOT NULL THEN RETURN null; END IF;

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
    -- Só quem vê TODAS as tarefas do quadro (v304: full, view_all, comment_all); vinculado já é avisado.
    IF public.gestao_nivel_ve_todas(public.gestao_resolver_nivel(r.email, 'task', v_t.id_tarefa))
       AND public.gestao_unidade_ok(r.email, v_t.id_tarefa)
       AND NOT EXISTS (SELECT 1 FROM public.gestao_tarefa_vinculados v WHERE v.id_tarefa = v_t.id_tarefa AND lower(v.usuario_email) = r.email) THEN
      PERFORM public.gestao_avisar(r.email, 'quadro', 'Nova tarefa em ' || v_q.nome || ': ' || v_t.titulo, v_t.id_tarefa, v_q.id_quadro, v_ator);
    END IF;
  END LOOP;
  RETURN null;
END $function$;

drop function if exists public.gestao_etapa_aviso_alternar(text, text);
drop function if exists public.gestao_etapas_avisadas(text);
drop table if exists public.gestao_etapa_avisos;
notify pgrst, 'reload schema';

commit;
