-- Rollback da v340 — volta gestao_avisar à definição anterior (um aviso por tipo e tarefa em 1 minuto).
begin;

CREATE OR REPLACE FUNCTION public.gestao_avisar(p_dest text, p_tipo text, p_titulo text, p_id_tarefa text, p_id_quadro text, p_ator text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_dest text := lower(btrim(coalesce(p_dest, '')));
BEGIN
  IF v_dest = '' OR v_dest = lower(coalesce(p_ator, '')) THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE lower(u.email) = v_dest AND coalesce(u.ativo_sistema, true) AND u.perfil <> 'Cliente') THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.gestao_notificacoes n
              WHERE lower(n.destinatario) = v_dest AND n.tipo = p_tipo AND n.id_tarefa IS NOT DISTINCT FROM p_id_tarefa
                AND n.created_at > now() - interval '1 minute') THEN
    RETURN;
  END IF;
  INSERT INTO public.gestao_notificacoes (id, destinatario, tipo, titulo, id_tarefa, id_quadro, canal)
  VALUES (gen_random_uuid(), v_dest, p_tipo, left(p_titulo, 300), p_id_tarefa, p_id_quadro, 'in_app+email');
END $function$;

commit;
