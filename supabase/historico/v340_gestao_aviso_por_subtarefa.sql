-- v340 — Gestão: um aviso por subtarefa atribuída (10/11/2026, 0.3.267).
--
-- Trazida da v352 do Painel SST (0.3.915). gestao_avisar não repetia aviso do mesmo tipo e da mesma tarefa para a mesma
-- pessoa em 1 minuto: dar PGR, LTCAT e PCMSO ao mesmo técnico de uma vez gerava UM aviso. Agora, só na atribuição, o
-- filtro também compara o texto: cada subtarefa avisa; as repetições iguais (ex.: o cartão atribuído duas vezes) e os
-- demais tipos (status, comentário, prazo…) seguem como antes.
-- Base: a definição ATUAL do JCN (sem o bloco das tarefas restritas, que é da v306 do Painel e não existe aqui).
-- Rollback: scripts/sql/v340_gestao_aviso_por_subtarefa_rollback.sql
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
  -- v340 (Painel v352): na atribuição, só junta aviso de texto IGUAL — cada subtarefa tem o seu.
  IF EXISTS (SELECT 1 FROM public.gestao_notificacoes n
              WHERE lower(n.destinatario) = v_dest AND n.tipo = p_tipo AND n.id_tarefa IS NOT DISTINCT FROM p_id_tarefa
                AND n.created_at > now() - interval '1 minute'
                AND (p_tipo <> 'atribuicao' OR n.titulo = left(p_titulo, 300))) THEN
    RETURN;
  END IF;
  INSERT INTO public.gestao_notificacoes (id, destinatario, tipo, titulo, id_tarefa, id_quadro, canal)
  VALUES (gen_random_uuid(), v_dest, p_tipo, left(p_titulo, 300), p_id_tarefa, p_id_quadro, 'in_app+email');
END $function$;

commit;
