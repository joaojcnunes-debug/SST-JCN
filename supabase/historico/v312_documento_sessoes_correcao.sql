-- v312 — Documento: correção de sessão de tempo pelo supervisor (30/10/2026)
--
-- POR QUÊ: fase 2 do apontamento de tempo (v311). Alguém esquece o cronômetro ligado, ou a pausa
-- automática fecha cedo demais: o supervisor ajusta o início/fim da sessão, com justificativa, e o
-- que era antes fica guardado.
--
-- O QUE FAZ
--   documento_sessoes.corrigida      marca a sessão ajustada (a tela mostra o selo).
--   documento_sessoes_correcoes      uma linha por correção: antes/depois (início, fim, motivo),
--                                    justificativa, quem e quando. Ninguém escreve direto; não tem
--                                    UPDATE/DELETE (só a função grava). FK na inspeção em cascata
--                                    (sem trava append-only: travaria a exclusão definitiva da
--                                    inspeção pela Lixeira — lição da v310).
--   documento_sessao_corrigir(id_sessao, inicio, fim, justificativa)
--                                    só supervisor/admin (perfil Admin ou nível Aprovação/Admin —
--                                    o ehSupervisor da tela) que enxerga a empresa. Regras: fim ≥
--                                    início, fim no passado, justificativa com 5+ letras, sem
--                                    sobrepor outra sessão da mesma pessoa. Sessão aberta fecha
--                                    (motivo PAUSA). Fim = início zera a sessão (anular).
--   RLS das correções: lê quem lê as sessões.
--
-- REAPLICAR: idempotente.
-- ROLLBACK: scripts/sql/v312_documento_sessoes_correcao_rollback.sql

DO $$ BEGIN
  IF to_regclass('public.documento_sessoes') IS NULL THEN
    RAISE EXCEPTION 'falta a v311 (documento_sessoes)';
  END IF;
END $$;

ALTER TABLE public.documento_sessoes ADD COLUMN IF NOT EXISTS corrigida boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.documento_sessoes_correcoes (
  id_correcao   text PRIMARY KEY DEFAULT ('DSC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  id_sessao     text NOT NULL,
  id_inspecao   text NOT NULL REFERENCES public.inspecoes(id_inspecao) ON DELETE CASCADE,
  antes         jsonb NOT NULL,
  depois        jsonb NOT NULL,
  justificativa text NOT NULL CHECK (length(btrim(justificativa)) >= 5),
  corrigido_por text NOT NULL,
  corrigido_em  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.documento_sessoes_correcoes IS
  'Documento (SGG): correções de sessão de tempo pelo supervisor (antes/depois, justificativa). v312.';
CREATE INDEX IF NOT EXISTS ix_documento_sessoes_correcoes_sessao ON public.documento_sessoes_correcoes (id_sessao, corrigido_em);

-- A trilha é a própria tabela (a v255 ligaria a auditoria sozinha; aqui seria repetição).
SELECT public.auditoria_desativar('documento_sessoes_correcoes');

ALTER TABLE public.documento_sessoes_correcoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS documento_sessoes_correcoes_select ON public.documento_sessoes_correcoes;
CREATE POLICY documento_sessoes_correcoes_select ON public.documento_sessoes_correcoes FOR SELECT TO authenticated
  USING (public.psico_caller_interno() AND EXISTS (
    SELECT 1 FROM public.inspecoes i
     WHERE i.id_inspecao = documento_sessoes_correcoes.id_inspecao AND public.caller_pode_ver_empresa(i.id_empresa)));
REVOKE INSERT, UPDATE, DELETE ON public.documento_sessoes_correcoes FROM anon, authenticated;
GRANT SELECT ON public.documento_sessoes_correcoes TO authenticated;

CREATE OR REPLACE FUNCTION public.documento_sessao_corrigir(
  p_id_sessao text, p_inicio timestamptz, p_fim timestamptz, p_justificativa text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u public.usuarios; s public.documento_sessoes; v_empresa text;
BEGIN
  SELECT * INTO u FROM public.usuarios
   WHERE lower(email) = lower(auth.jwt() ->> 'email') AND ativo_sistema = true LIMIT 1;
  IF u.id_usuario IS NULL OR NOT (u.perfil = 'Admin' OR u.nivel IN ('Aprovacao', 'Admin')) THEN
    RAISE EXCEPTION 'so supervisor ou administrador corrige sessao';
  END IF;
  SELECT * INTO s FROM public.documento_sessoes WHERE id_sessao = p_id_sessao FOR UPDATE;
  IF s.id_sessao IS NULL THEN RAISE EXCEPTION 'sessao nao encontrada'; END IF;
  SELECT id_empresa INTO v_empresa FROM public.inspecoes WHERE id_inspecao = s.id_inspecao;
  IF NOT public.caller_pode_ver_empresa(v_empresa) THEN RAISE EXCEPTION 'sem acesso a esta empresa'; END IF;

  IF length(btrim(coalesce(p_justificativa, ''))) < 5 THEN RAISE EXCEPTION 'justificativa obrigatoria'; END IF;
  IF p_inicio IS NULL OR p_fim IS NULL OR p_fim < p_inicio THEN RAISE EXCEPTION 'fim antes do inicio'; END IF;
  IF p_fim > now() + interval '1 minute' THEN RAISE EXCEPTION 'fim no futuro'; END IF;
  IF EXISTS (
       SELECT 1 FROM public.documento_sessoes o
        WHERE o.id_usuario = s.id_usuario AND o.id_sessao <> s.id_sessao
          AND o.inicio < p_fim AND coalesce(o.fim, o.ultima_atividade) > p_inicio) THEN
    RAISE EXCEPTION 'o periodo sobrepoe outra sessao da mesma pessoa';
  END IF;

  INSERT INTO public.documento_sessoes_correcoes (id_sessao, id_inspecao, antes, depois, justificativa, corrigido_por)
  VALUES (s.id_sessao, s.id_inspecao,
          jsonb_build_object('inicio', s.inicio, 'fim', s.fim, 'motivo_fim', s.motivo_fim),
          jsonb_build_object('inicio', p_inicio, 'fim', least(p_fim, now()), 'motivo_fim', coalesce(s.motivo_fim, 'PAUSA')),
          btrim(p_justificativa), lower(u.email));

  UPDATE public.documento_sessoes
     SET inicio = p_inicio,
         fim = least(p_fim, now()),
         motivo_fim = coalesce(motivo_fim, 'PAUSA'),
         ultima_atividade = least(p_fim, now()),
         corrigida = true
   WHERE id_sessao = s.id_sessao;
END $$;

REVOKE ALL ON FUNCTION public.documento_sessao_corrigir(text, timestamptz, timestamptz, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.documento_sessao_corrigir(text, timestamptz, timestamptz, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
