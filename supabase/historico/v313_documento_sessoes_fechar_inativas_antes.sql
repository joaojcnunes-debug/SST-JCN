-- v313 — Documento: pausar e concluir fecham antes as sessões paradas (30/10/2026)
--
-- POR QUÊ: a v311 fecha a sessão parada há 30 min no momento da última atividade, mas só pelo
-- pg_cron (a cada 5 min) e antes de iniciar/atividade. Pausar uma sessão já parada — ou concluir
-- o documento com uma delas aberta — gravava o fim como "agora" e inflava o tempo trabalhado.
-- Agora as duas chamam documento_sessoes_fechar_inativas() antes. (Vale também para bancos sem
-- pg_cron, como o do Painel: aí a contagem não depende do relógio.)
--
-- REAPLICAR: idempotente. ROLLBACK: reaplicar as funções da v311.

DO $$ BEGIN
  IF to_regprocedure('public.documento_sessoes_fechar_inativas()') IS NULL THEN
    RAISE EXCEPTION 'falta a v311 (documento_sessoes)';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.documento_sessao_pausar(p_id_inspecao text, p_motivo text DEFAULT 'PAUSA')
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u public.usuarios; n integer;
BEGIN
  IF coalesce(p_motivo, 'PAUSA') NOT IN ('PAUSA', 'AGUARDANDO_CLIENTE', 'AGUARDANDO_TECNICO', 'OUTRA_PRIORIDADE', 'FIM_EXPEDIENTE') THEN
    RAISE EXCEPTION 'motivo invalido';
  END IF;
  u := public.documento_sessao_quem(p_id_inspecao);
  PERFORM public.documento_sessoes_fechar_inativas();
  UPDATE public.documento_sessoes
     SET fim = greatest(now(), inicio), motivo_fim = coalesce(p_motivo, 'PAUSA')
   WHERE id_usuario = u.id_usuario AND id_inspecao = p_id_inspecao AND fim IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END $$;

CREATE OR REPLACE FUNCTION public.documento_sessoes_fechar_por_status_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF new.elaboracao_status IS DISTINCT FROM old.elaboracao_status
     AND coalesce(new.elaboracao_status, 'PENDENTE') IN ('CONCLUIDO', 'PENDENTE') THEN
    PERFORM public.documento_sessoes_fechar_inativas();
    UPDATE public.documento_sessoes
       SET fim = greatest(now(), inicio),
           motivo_fim = CASE WHEN new.elaboracao_status = 'CONCLUIDO' THEN 'CONCLUIDO' ELSE 'LIBERADO' END
     WHERE id_inspecao = new.id_inspecao AND fim IS NULL;
  END IF;
  RETURN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
