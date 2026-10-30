-- v314 — Documento: desfazer a conclusão por engano (30/10/2026)
--
-- POR QUÊ: o associado que concluía o documento por engano dependia do supervisor (Reabrir), e a
-- conclusão deixava marcas que o Reabrir não tira: o documento passava a contar como emitido no
-- mês (primeira_elaboracao_em, travada pelo gatilho inspecoes_primeira_conclusao). Pedido de 30/10:
-- confirmação antes de concluir (na tela) e um "Desfazer" para quem concluiu.
--
-- O QUE FAZ
--   inspecoes.elaboracao_concluida_por   e-mail de quem concluiu (gatilho; limpa ao sair de CONCLUIDO).
--   documento_desfazer_conclusao(id)     só QUEM CONCLUIU, até 10 min depois: volta a EM_ELABORACAO
--                                        (mesmo responsável), limpa a data de conclusão e — se ESTA
--                                        conclusão foi a primeira — a marca de emitido no mês
--                                        (primeira_elaboracao_em/_por); reabre a sessão de tempo dela
--                                        fechada pela conclusão (v311). Depois de 10 min, só o
--                                        Reabrir do supervisor (que não mexe na primeira conclusão).
--   inspecoes_primeira_conclusao_trg     aceita limpar a primeira elaboração SÓ dentro dessa função
--                                        (flag de transação jcn.desfazer_conclusao).
--   A automação da Gestão "documento concluído" já disparou e não repete (chave 'doc:<id>').
--
-- REAPLICAR: idempotente.
-- ROLLBACK: scripts/sql/v314_documento_desfazer_conclusao_rollback.sql

DO $$ BEGIN
  IF to_regclass('public.documento_sessoes') IS NULL
     OR to_regprocedure('public.inspecoes_primeira_conclusao_trg()') IS NULL THEN
    RAISE EXCEPTION 'falta a v311 (documento_sessoes) ou inspecoes_primeira_conclusao_trg';
  END IF;
END $$;

ALTER TABLE public.inspecoes ADD COLUMN IF NOT EXISTS elaboracao_concluida_por text;
COMMENT ON COLUMN public.inspecoes.elaboracao_concluida_por IS
  'v314: e-mail de quem concluiu o documento (para o Desfazer de 10 min); nulo fora de CONCLUIDO.';

CREATE OR REPLACE FUNCTION public.inspecoes_elaboracao_concluida_por_trg()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF new.elaboracao_status IS DISTINCT FROM old.elaboracao_status THEN
    IF new.elaboracao_status = 'CONCLUIDO' THEN
      new.elaboracao_concluida_por := lower(nullif(coalesce(auth.jwt() ->> 'email', ''), ''));
    ELSE
      new.elaboracao_concluida_por := null;
    END IF;
  END IF;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_inspecoes_elaboracao_concluida_por ON public.inspecoes;
CREATE TRIGGER trg_inspecoes_elaboracao_concluida_por
  BEFORE UPDATE OF elaboracao_status ON public.inspecoes
  FOR EACH ROW EXECUTE FUNCTION public.inspecoes_elaboracao_concluida_por_trg();

-- A primeira conclusão continua travada — exceto dentro do Desfazer (flag de transação).
CREATE OR REPLACE FUNCTION public.inspecoes_primeira_conclusao_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if tg_op = 'UPDATE' then
    new.primeira_conclusao_em       := old.primeira_conclusao_em;
    new.primeira_conclusao_por      := old.primeira_conclusao_por;
    new.primeira_conclusao_tecnicos := old.primeira_conclusao_tecnicos;
    if coalesce(current_setting('jcn.desfazer_conclusao', true), '') <> 'on' then
      new.primeira_elaboracao_em      := old.primeira_elaboracao_em;
      new.primeira_elaboracao_por     := old.primeira_elaboracao_por;
    end if;
  else
    new.primeira_conclusao_em := null; new.primeira_conclusao_por := null; new.primeira_conclusao_tecnicos := null;
    new.primeira_elaboracao_em := null; new.primeira_elaboracao_por := null;
  end if;
  if new.primeira_conclusao_em is null and new.status = 'CONCLUIDA'
     and (tg_op = 'INSERT' or old.status is distinct from 'CONCLUIDA') then
    new.primeira_conclusao_em       := least(coalesce(new.concluida_em, now()), now());
    new.primeira_conclusao_por      := new.concluida_por_email;
    new.primeira_conclusao_tecnicos := public.inspecao_tecnicos_campo_json(new.id_inspecao);
  end if;
  if new.primeira_elaboracao_em is null and new.elaboracao_status = 'CONCLUIDO'
     and (tg_op = 'INSERT' or old.elaboracao_status is distinct from 'CONCLUIDO') then
    new.primeira_elaboracao_em  := least(coalesce(new.elaboracao_concluida_em, now()), now());
    new.primeira_elaboracao_por := new.elaboracao_responsavel;
  end if;
  return new;
end $$;

CREATE OR REPLACE FUNCTION public.documento_desfazer_conclusao(p_id_inspecao text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u public.usuarios; i record; v_era_primeira boolean; v_sessao text;
BEGIN
  u := public.documento_sessao_quem(p_id_inspecao);
  SELECT elaboracao_status, elaboracao_concluida_em, elaboracao_concluida_por, primeira_elaboracao_em
    INTO i FROM public.inspecoes WHERE id_inspecao = p_id_inspecao FOR UPDATE;
  IF coalesce(i.elaboracao_status, '') <> 'CONCLUIDO' THEN RAISE EXCEPTION 'o documento nao esta concluido'; END IF;
  IF i.elaboracao_concluida_por IS DISTINCT FROM lower(u.email) THEN
    RAISE EXCEPTION 'so quem concluiu desfaz; peca ao supervisor para reabrir';
  END IF;
  IF i.elaboracao_concluida_em IS NULL OR i.elaboracao_concluida_em < now() - interval '10 minutes' THEN
    RAISE EXCEPTION 'passou o prazo de 10 minutos; peca ao supervisor para reabrir';
  END IF;
  -- Esta conclusão foi a primeira? (a primeira grava a mesma data da conclusão)
  v_era_primeira := i.primeira_elaboracao_em IS NOT NULL
    AND abs(extract(epoch FROM (i.primeira_elaboracao_em - i.elaboracao_concluida_em))) < 2;

  PERFORM set_config('jcn.desfazer_conclusao', 'on', true);
  UPDATE public.inspecoes
     SET elaboracao_status = 'EM_ELABORACAO',
         elaboracao_concluida_em = null,
         primeira_elaboracao_em = CASE WHEN v_era_primeira THEN null ELSE primeira_elaboracao_em END,
         primeira_elaboracao_por = CASE WHEN v_era_primeira THEN null ELSE primeira_elaboracao_por END,
         updated_at = now()
   WHERE id_inspecao = p_id_inspecao;
  PERFORM set_config('jcn.desfazer_conclusao', 'off', true);

  -- Reabre a sessão dela que a conclusão fechou (se não abriu outra nesse meio-tempo).
  IF NOT EXISTS (SELECT 1 FROM public.documento_sessoes WHERE id_usuario = u.id_usuario AND fim IS NULL) THEN
    SELECT id_sessao INTO v_sessao FROM public.documento_sessoes
     WHERE id_inspecao = p_id_inspecao AND id_usuario = u.id_usuario
       AND motivo_fim = 'CONCLUIDO' AND fim >= i.elaboracao_concluida_em - interval '1 minute'
     ORDER BY fim DESC LIMIT 1;
    IF v_sessao IS NOT NULL THEN
      UPDATE public.documento_sessoes SET fim = null, motivo_fim = null, ultima_atividade = now()
       WHERE id_sessao = v_sessao;
    END IF;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.inspecoes_elaboracao_concluida_por_trg() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.documento_desfazer_conclusao(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.documento_desfazer_conclusao(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
