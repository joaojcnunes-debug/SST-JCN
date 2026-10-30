-- v311 — Documento: apontamento de tempo por sessão (30/10/2026)
--
-- POR QUÊ: o "Iniciar" (v309) gravava um momento só, por inspeção. Pedido de 30/10: o Iniciar é
-- para controle do tempo atuante no documento. Decisões dele: só no documento (associados); pausa
-- sozinha depois de 30 minutos sem atividade; "aguardando cliente" conta à parte e não entra no
-- tempo trabalhado.
--
-- O QUE FAZ
--   documento_sessoes      uma linha por período de trabalho de UMA pessoa num documento:
--                          início, última atividade, fim e o motivo do fim. Uma sessão aberta por
--                          pessoa (índice único parcial): iniciar outra fecha a anterior (TROCA).
--   documento_sessao_iniciar(id)          abre (ou devolve a aberta) — só associado da inspeção;
--                                         com o documento PENDENTE, passa a EM_ELABORACAO (o
--                                         gatilho da v309 carimba o início, origem BOTAO).
--   documento_sessao_pausar(id, motivo)   fecha a sessão aberta de quem chama naquele documento.
--   documento_sessao_atividade(id)        "ainda estou aqui" (a tela manda a cada interação,
--                                         no máximo a cada 2 min); devolve false se não há sessão.
--   documento_sessoes_fechar_inativas()   fecha as sessões paradas há 30 min no momento da última
--                                         atividade (INATIVIDADE, fechada_auto) — pg_cron a cada 5 min
--                                         e também antes de cada iniciar/atividade.
--   gatilho em inspecoes   concluir o documento fecha as sessões abertas dele (CONCLUIDO);
--                          "Liberar" (volta a PENDENTE) fecha como LIBERADO.
--   Motivos da pausa: PAUSA · AGUARDANDO_CLIENTE · AGUARDANDO_TECNICO · OUTRA_PRIORIDADE ·
--   FIM_EXPEDIENTE. "Aguardando cliente" = do fim dessa sessão até o próximo início no documento
--   (a conta é da tela: lib/inspecoes/sessoes.ts).
--   RLS: lê a equipe interna que enxerga a empresa; ninguém escreve direto — só pelas funções.
--   Sem trilha na auditoria (a atividade atualizaria a linha a cada 2 min).
--
-- REAPLICAR: idempotente.
-- ROLLBACK: scripts/sql/v311_documento_sessoes_tempo_rollback.sql

DO $$ BEGIN
  IF to_regprocedure('public.psico_caller_interno()') IS NULL
     OR to_regprocedure('public.caller_pode_ver_empresa(text)') IS NULL
     OR to_regprocedure('public.sem_acento(text)') IS NULL
     OR to_regprocedure('public.auditoria_desativar(text)') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = 'inspecoes'
                       AND column_name = 'elaboracao_iniciada_em') THEN
    RAISE EXCEPTION 'falta a v309 (início da elaboração) ou psico_caller_interno/caller_pode_ver_empresa/sem_acento/auditoria_desativar';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.documento_sessoes (
  id_sessao        text PRIMARY KEY DEFAULT ('DSE-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  id_inspecao      text NOT NULL REFERENCES public.inspecoes(id_inspecao) ON DELETE CASCADE,
  id_usuario       text NOT NULL,
  nome             text NOT NULL,
  email            text NOT NULL,
  inicio           timestamptz NOT NULL DEFAULT now(),
  ultima_atividade timestamptz NOT NULL DEFAULT now(),
  fim              timestamptz,
  motivo_fim       text CHECK (motivo_fim IS NULL OR motivo_fim IN (
                     'PAUSA', 'AGUARDANDO_CLIENTE', 'AGUARDANDO_TECNICO', 'OUTRA_PRIORIDADE', 'FIM_EXPEDIENTE',
                     'TROCA', 'INATIVIDADE', 'CONCLUIDO', 'LIBERADO')),
  fechada_auto     boolean NOT NULL DEFAULT false,
  CHECK (fim IS NULL OR fim >= inicio),
  CHECK ((fim IS NULL) = (motivo_fim IS NULL))
);
COMMENT ON TABLE public.documento_sessoes IS
  'Documento (SGG): períodos de trabalho de cada associado (Iniciar/Pausar/Retomar). v311.';
CREATE UNIQUE INDEX IF NOT EXISTS ux_documento_sessao_aberta ON public.documento_sessoes (id_usuario) WHERE fim IS NULL;
CREATE INDEX IF NOT EXISTS ix_documento_sessoes_inspecao ON public.documento_sessoes (id_inspecao, inicio);
CREATE INDEX IF NOT EXISTS ix_documento_sessoes_usuario ON public.documento_sessoes (id_usuario, inicio);

-- A atividade muda a linha a cada 2 min: sem trilha (a v255 liga sozinha em tabela nova).
SELECT public.auditoria_desativar('documento_sessoes');

ALTER TABLE public.documento_sessoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS documento_sessoes_select ON public.documento_sessoes;
CREATE POLICY documento_sessoes_select ON public.documento_sessoes FOR SELECT TO authenticated
  USING (public.psico_caller_interno() AND EXISTS (
    SELECT 1 FROM public.inspecoes i
     WHERE i.id_inspecao = documento_sessoes.id_inspecao AND public.caller_pode_ver_empresa(i.id_empresa)));
REVOKE INSERT, UPDATE, DELETE ON public.documento_sessoes FROM anon, authenticated;
GRANT SELECT ON public.documento_sessoes TO authenticated;

-- ── fecha as paradas há 30 min, no momento da última atividade ───────────────
CREATE OR REPLACE FUNCTION public.documento_sessoes_fechar_inativas()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE public.documento_sessoes
     SET fim = ultima_atividade, motivo_fim = 'INATIVIDADE', fechada_auto = true
   WHERE fim IS NULL AND ultima_atividade < now() - interval '30 minutes';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- Quem chama: usuário interno ativo que enxerga a empresa da inspeção.
CREATE OR REPLACE FUNCTION public.documento_sessao_quem(p_id_inspecao text)
RETURNS public.usuarios LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE u public.usuarios; v_empresa text;
BEGIN
  SELECT * INTO u FROM public.usuarios
   WHERE lower(email) = lower(auth.jwt() ->> 'email') AND ativo_sistema = true LIMIT 1;
  IF u.id_usuario IS NULL OR u.perfil = 'Cliente' THEN RAISE EXCEPTION 'sem permissao'; END IF;
  SELECT id_empresa INTO v_empresa FROM public.inspecoes WHERE id_inspecao = p_id_inspecao;
  IF NOT FOUND THEN RAISE EXCEPTION 'inspecao nao encontrada'; END IF;
  IF NOT public.caller_pode_ver_empresa(v_empresa) THEN RAISE EXCEPTION 'sem acesso a esta empresa'; END IF;
  RETURN u;
END $$;

CREATE OR REPLACE FUNCTION public.documento_sessao_iniciar(p_id_inspecao text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u public.usuarios; v_status text; v_aberta text; v_id text;
BEGIN
  u := public.documento_sessao_quem(p_id_inspecao);
  IF NOT EXISTS (
       SELECT 1 FROM public.inspecao_associados a
        WHERE a.id_inspecao = p_id_inspecao
          AND (a.id_usuario = u.id_usuario
               OR (nullif(btrim(a.nome), '') IS NOT NULL
                   AND lower(public.sem_acento(btrim(a.nome))) = lower(public.sem_acento(btrim(u.nome)))))) THEN
    RAISE EXCEPTION 'so quem esta associado ao documento aponta tempo nele';
  END IF;
  SELECT coalesce(elaboracao_status, 'PENDENTE') INTO v_status FROM public.inspecoes WHERE id_inspecao = p_id_inspecao;
  IF v_status = 'CONCLUIDO' THEN RAISE EXCEPTION 'documento ja entregue'; END IF;

  PERFORM public.documento_sessoes_fechar_inativas();
  SELECT id_sessao, id_inspecao INTO v_aberta, v_id FROM public.documento_sessoes
   WHERE id_usuario = u.id_usuario AND fim IS NULL;
  IF v_aberta IS NOT NULL AND v_id = p_id_inspecao THEN
    UPDATE public.documento_sessoes SET ultima_atividade = now() WHERE id_sessao = v_aberta;
    RETURN v_aberta;
  END IF;
  IF v_aberta IS NOT NULL THEN
    UPDATE public.documento_sessoes SET fim = now(), motivo_fim = 'TROCA' WHERE id_sessao = v_aberta;
  END IF;

  IF v_status = 'PENDENTE' THEN
    UPDATE public.inspecoes
       SET elaboracao_status = 'EM_ELABORACAO',
           elaboracao_responsavel = coalesce(nullif(btrim(elaboracao_responsavel), ''), u.nome),
           updated_at = now()
     WHERE id_inspecao = p_id_inspecao;
  END IF;

  INSERT INTO public.documento_sessoes (id_inspecao, id_usuario, nome, email)
  VALUES (p_id_inspecao, u.id_usuario, u.nome, lower(u.email))
  RETURNING id_sessao INTO v_aberta;
  RETURN v_aberta;
END $$;

CREATE OR REPLACE FUNCTION public.documento_sessao_pausar(p_id_inspecao text, p_motivo text DEFAULT 'PAUSA')
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u public.usuarios; n integer;
BEGIN
  IF coalesce(p_motivo, 'PAUSA') NOT IN ('PAUSA', 'AGUARDANDO_CLIENTE', 'AGUARDANDO_TECNICO', 'OUTRA_PRIORIDADE', 'FIM_EXPEDIENTE') THEN
    RAISE EXCEPTION 'motivo invalido';
  END IF;
  u := public.documento_sessao_quem(p_id_inspecao);
  UPDATE public.documento_sessoes
     SET fim = greatest(now(), inicio), motivo_fim = coalesce(p_motivo, 'PAUSA')
   WHERE id_usuario = u.id_usuario AND id_inspecao = p_id_inspecao AND fim IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END $$;

CREATE OR REPLACE FUNCTION public.documento_sessao_atividade(p_id_inspecao text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u public.usuarios; n integer;
BEGIN
  u := public.documento_sessao_quem(p_id_inspecao);
  PERFORM public.documento_sessoes_fechar_inativas();
  UPDATE public.documento_sessoes SET ultima_atividade = now()
   WHERE id_usuario = u.id_usuario AND id_inspecao = p_id_inspecao AND fim IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END $$;

-- ── concluir/liberar o documento fecha as sessões abertas dele ───────────────
CREATE OR REPLACE FUNCTION public.documento_sessoes_fechar_por_status_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF new.elaboracao_status IS DISTINCT FROM old.elaboracao_status
     AND coalesce(new.elaboracao_status, 'PENDENTE') IN ('CONCLUIDO', 'PENDENTE') THEN
    UPDATE public.documento_sessoes
       SET fim = greatest(now(), inicio),
           motivo_fim = CASE WHEN new.elaboracao_status = 'CONCLUIDO' THEN 'CONCLUIDO' ELSE 'LIBERADO' END
     WHERE id_inspecao = new.id_inspecao AND fim IS NULL;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_documento_sessoes_fechar_por_status ON public.inspecoes;
CREATE TRIGGER trg_documento_sessoes_fechar_por_status
  AFTER UPDATE OF elaboracao_status ON public.inspecoes
  FOR EACH ROW EXECUTE FUNCTION public.documento_sessoes_fechar_por_status_trg();

REVOKE ALL ON FUNCTION public.documento_sessoes_fechar_inativas() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.documento_sessao_quem(text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.documento_sessoes_fechar_por_status_trg() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.documento_sessao_iniciar(text) FROM public, anon;
REVOKE ALL ON FUNCTION public.documento_sessao_pausar(text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.documento_sessao_atividade(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.documento_sessao_iniciar(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.documento_sessao_pausar(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.documento_sessao_atividade(text) TO authenticated;

-- pg_cron: fecha as inativas a cada 5 minutos.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'documento-sessoes-inativas') THEN
    PERFORM cron.unschedule('documento-sessoes-inativas');
  END IF;
  PERFORM cron.schedule('documento-sessoes-inativas', '*/5 * * * *', 'select public.documento_sessoes_fechar_inativas()');
END $$;

NOTIFY pgrst, 'reload schema';
