-- v290 (JCN) — Gestão: vários responsáveis + avisos (painel e e-mail) gerados no servidor
-- Replicado do Painel SST (v296, v0.3.766), sem a trava de banco do painel, sem owner chabra_admin
-- e sem schema_migrations.
--
-- REAPLICAR: idempotente. ROLLBACK: scripts/sql/v290_*_rollback.sql

-- v296 — vários responsáveis + avisos (painel e e-mail) gerados no SERVIDOR.
--
-- PEDIDO (19/10): botão "+" para mais de um responsável na tarefa; avisar a pessoa alocada no
-- painel e por e-mail. Decisões do usuário: responsável E seguidor recebem; TODO evento gera
-- e-mail (atribuição, status, comentário, menção).
--
-- O QUE FAZ
--   1) Espelho gestao_tarefas.responsavel = TODOS os responsáveis ("Ana, João"), na ordem em que
--      entraram. O banco já aceitava N responsáveis (único por tarefa+e-mail+tipo); só a tela limitava.
--   2) Avisos nascem por gatilho (antes eram criados pelo navegador, só na tela da tarefa e só para
--      o responsável; formulário/automação não avisavam ninguém):
--        • vínculo novo (responsável/seguidor)        → aviso à pessoa incluída
--        • status mudou                               → aviso a todos os vinculados
--        • comentário                                 → aviso aos vinculados; "@nome" → menção
--      Quem fez a ação não é avisado (ator = e-mail do JWT). Sem duplicar o mesmo aviso em 1 min.
--   3) E-mail: colunas de controle + RPCs (só service_role) para o worker /api/gestao/google/sync
--      (agendador, 1/min) reservar e concluir o envio, sem mandar duas vezes. Avisos ANTIGOS ficam
--      marcados como enviados (ninguém recebe e-mail retroativo).
--

-- ── 1) Espelho com todos os responsáveis ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.gestao_vinculo_espelho_trg()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_id text; v_nome text;
begin
  -- guarda de recursao: se ja estamos dentro de um sync, nao reentra.
  if coalesce(current_setting('gestao.in_vinculo_sync', true), '') = 'on' then
    return null;
  end if;
  -- so reconcilia quando o papel envolvido e 'responsavel'.
  if coalesce(new.tipo, old.tipo) is distinct from 'responsavel' then
    return null;
  end if;
  v_id := coalesce(new.id_tarefa, old.id_tarefa);

  -- v296: todos os responsaveis, na ordem em que entraram ("Ana, Joao"). Antes: so o ultimo.
  select string_agg(coalesce(u.nome, v.usuario_email), ', ' order by v.created_at, v.usuario_email) into v_nome
    from public.gestao_tarefa_vinculados v
    left join public.usuarios u on lower(u.email) = v.usuario_email
   where v.id_tarefa = v_id and v.tipo = 'responsavel';

  perform set_config('gestao.in_vinculo_sync', 'on', true);   -- is_local: so nesta transacao
  update public.gestao_tarefas
     set responsavel = v_nome, updated_at = now()
   where id_tarefa = v_id and responsavel is distinct from v_nome;
  perform set_config('gestao.in_vinculo_sync', 'off', true);

  return null;
end $function$;

-- ── 2) Avisos ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.gestao_notificacoes
  ADD COLUMN IF NOT EXISTS email_tentativas int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_reservado_em timestamptz,
  ADD COLUMN IF NOT EXISTS email_erro text;
-- Nada de e-mail retroativo: o que já existia conta como enviado.
UPDATE public.gestao_notificacoes SET email_enviado = true WHERE NOT email_enviado AND created_at < now();
CREATE INDEX IF NOT EXISTS idx_gestao_notif_email_pend ON public.gestao_notificacoes (created_at) WHERE NOT email_enviado;

-- Cria um aviso (painel + e-mail). Ignora: destinatário vazio, o próprio ator, usuário inativo/
-- inexistente, e o mesmo aviso (destinatário+tipo+tarefa) criado no último minuto.
CREATE OR REPLACE FUNCTION public.gestao_avisar(p_dest text, p_tipo text, p_titulo text, p_id_tarefa text, p_id_quadro text, p_ator text)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
END $$;
REVOKE ALL ON FUNCTION public.gestao_avisar(text, text, text, text, text, text) FROM public, anon, authenticated;

-- 2a) Vínculo novo → aviso à pessoa incluída.
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
DROP TRIGGER IF EXISTS trg_gestao_aviso_vinculo ON public.gestao_tarefa_vinculados;
CREATE TRIGGER trg_gestao_aviso_vinculo AFTER INSERT ON public.gestao_tarefa_vinculados
  FOR EACH ROW EXECUTE FUNCTION public.gestao_aviso_vinculo_trg();

-- 2b) Status mudou → aviso a todos os vinculados.
CREATE OR REPLACE FUNCTION public.gestao_aviso_status_trg() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nome text; v_ator text := public.gestao_email(); r record;
BEGIN
  SELECT s.nome INTO v_nome FROM public.gestao_status s WHERE s.id_quadro = new.id_quadro AND s.slug = new.status;
  FOR r IN SELECT DISTINCT usuario_email FROM public.gestao_tarefa_vinculados WHERE id_tarefa = new.id_tarefa LOOP
    PERFORM public.gestao_avisar(r.usuario_email, 'status',
      '"' || new.titulo || '" mudou para ' || coalesce(v_nome, new.status), new.id_tarefa, new.id_quadro, v_ator);
  END LOOP;
  RETURN null;
END $$;
DROP TRIGGER IF EXISTS trg_gestao_aviso_status ON public.gestao_tarefas;
CREATE TRIGGER trg_gestao_aviso_status AFTER UPDATE OF status ON public.gestao_tarefas
  FOR EACH ROW WHEN (old.status IS DISTINCT FROM new.status)
  EXECUTE FUNCTION public.gestao_aviso_status_trg();

-- 2c) Comentário → vinculados ("comentario") e "@nome"/"@primeironome" ("mencao").
CREATE OR REPLACE FUNCTION public.gestao_aviso_comentario_trg() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t record; v_ator text := public.gestao_email(); v_txt text := lower(coalesce(new.texto, '')); r record;
  v_mencionados text[] := '{}';
BEGIN
  SELECT titulo, id_quadro INTO v_t FROM public.gestao_tarefas WHERE id_tarefa = new.id_tarefa;
  IF NOT FOUND THEN RETURN null; END IF;
  -- Mesma regra do detectarMencoes do app: "@Nome Completo" ou "@Primeiro".
  IF position('@' in v_txt) > 0 THEN
    SELECT coalesce(array_agg(DISTINCT lower(u.email)), '{}') INTO v_mencionados
      FROM public.usuarios u
     WHERE u.perfil <> 'Cliente' AND coalesce(u.ativo_sistema, true) AND btrim(coalesce(u.nome, '')) <> ''
       AND (position('@' || lower(btrim(u.nome)) in v_txt) > 0
            OR position('@' || lower(split_part(btrim(u.nome), ' ', 1)) in v_txt) > 0);
  END IF;
  FOR r IN SELECT unnest(v_mencionados) AS email LOOP
    PERFORM public.gestao_avisar(r.email, 'mencao', 'Você foi mencionado em "' || v_t.titulo || '"', new.id_tarefa, v_t.id_quadro, v_ator);
  END LOOP;
  FOR r IN SELECT DISTINCT lower(usuario_email) AS email FROM public.gestao_tarefa_vinculados WHERE id_tarefa = new.id_tarefa LOOP
    IF NOT (r.email = ANY (v_mencionados)) THEN
      PERFORM public.gestao_avisar(r.email, 'comentario', 'Novo comentário em "' || v_t.titulo || '"', new.id_tarefa, v_t.id_quadro, v_ator);
    END IF;
  END LOOP;
  RETURN null;
END $$;
DROP TRIGGER IF EXISTS trg_gestao_aviso_comentario ON public.gestao_comentarios;
CREATE TRIGGER trg_gestao_aviso_comentario AFTER INSERT ON public.gestao_comentarios
  FOR EACH ROW EXECUTE FUNCTION public.gestao_aviso_comentario_trg();

-- Funções de gatilho não são chamáveis pela API, mas fecha mesmo assim (default privilege).
REVOKE ALL ON FUNCTION public.gestao_aviso_vinculo_trg() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gestao_aviso_status_trg() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gestao_aviso_comentario_trg() FROM public, anon, authenticated;

-- ── 3) E-mail: reservar e concluir (só o servidor) ─────────────────────────────────
-- Reserva até p_limite avisos ainda não enviados (máx. 5 tentativas; reserva expira em 10 min,
-- para um envio interrompido voltar à fila). SKIP LOCKED: duas chamadas juntas não pegam o mesmo.
CREATE OR REPLACE FUNCTION public.gestao_aviso_email_reservar(p_limite int)
  RETURNS TABLE (id uuid, destinatario text, nome text, tipo text, titulo text, id_tarefa text, id_quadro text,
                 tarefa_titulo text, quadro_nome text, prazo date)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH alvo AS (
    SELECT n.id FROM public.gestao_notificacoes n
     WHERE NOT n.email_enviado AND n.email_tentativas < 5
       AND (n.email_reservado_em IS NULL OR n.email_reservado_em < now() - interval '10 minutes')
     ORDER BY n.created_at
     LIMIT greatest(1, least(coalesce(p_limite, 20), 100))
     FOR UPDATE SKIP LOCKED
  ), res AS (
    UPDATE public.gestao_notificacoes n
       SET email_reservado_em = now(), email_tentativas = n.email_tentativas + 1
      FROM alvo WHERE n.id = alvo.id
    RETURNING n.id, n.destinatario, n.tipo, n.titulo, n.id_tarefa, n.id_quadro
  )
  SELECT res.id, res.destinatario, u.nome, res.tipo, res.titulo, res.id_tarefa, res.id_quadro,
         t.titulo, q.nome, t.prazo
    FROM res
    LEFT JOIN public.usuarios u ON lower(u.email) = lower(res.destinatario)
    LEFT JOIN public.gestao_tarefas t ON t.id_tarefa = res.id_tarefa
    LEFT JOIN public.gestao_quadros q ON q.id_quadro = coalesce(res.id_quadro, t.id_quadro);
END $$;

CREATE OR REPLACE FUNCTION public.gestao_aviso_email_concluir(p_id uuid, p_ok boolean, p_erro text)
  RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.gestao_notificacoes
     SET email_enviado = p_ok, email_reservado_em = NULL, email_erro = CASE WHEN p_ok THEN NULL ELSE left(p_erro, 300) END
   WHERE id = p_id;
$$;

REVOKE ALL ON FUNCTION public.gestao_aviso_email_reservar(int) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gestao_aviso_email_concluir(uuid, boolean, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gestao_aviso_email_reservar(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.gestao_aviso_email_concluir(uuid, boolean, text) TO service_role;

NOTIFY pgrst, 'reload schema';
