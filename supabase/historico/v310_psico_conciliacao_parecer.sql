-- v310 (JCN) — Conciliação DRPS/QPS × AEP: parecer, fechamento e ligação de setores
--
-- POR QUÊ (29/10/2026): a página de Conciliação (0.3.174) só comparava. Para a NR-01 a
-- avaliação dos fatores psicossociais precisa ficar DOCUMENTADA (conclusão, quem, quando,
-- com quais documentos) e virar ação no plano; para a NR-17 (17.3.2) a divergência entre a
-- percepção dos trabalhadores e a AEP é o gatilho de "avaliação mais aprofundada" (AET).
-- E o casamento só pelo nome deixava "SAC" × "Atendimento" sem par.
--
-- O QUE FAZ
--   1) psico_conciliacao_setor_depara — por empresa, "este setor é o mesmo que aquele"
--      (chave do nome sugerido → chave do setor de destino). Vale só na Conciliação.
--   2) psico_conciliacao_pareceres — a conclusão de cada cruzamento setor × fator ×
--      questionário: CONFIRMAR (vai ao inventário do PGR), AET (aprofundar, NR-17) ou
--      DESCARTAR (com justificativa). Guarda a classe e os documentos do momento e,
--      se gerada, a ação 5W2H. Editável; a trilha fica na auditoria (v255, liga sozinha).
--   3) psico_conciliacao_fechamentos — a conciliação fechada: foto imutável (append-only,
--      mesmo gatilho da v287) com documentos, régua, totais e pareceres.
--   RLS: lê a equipe interna que enxerga a empresa; escreve QUALQUER pessoa que edita
--   (caller_pode_editar) e enxerga a empresa — decisão do pedido de 29/10.
--
-- REAPLICAR: idempotente.
-- ROLLBACK: scripts/sql/v310_psico_conciliacao_parecer_rollback.sql

DO $$ BEGIN
  IF to_regprocedure('public.caller_pode_editar()') IS NULL
     OR to_regprocedure('public.caller_pode_ver_empresa(text)') IS NULL
     OR to_regprocedure('public.psico_caller_interno()') IS NULL
     OR to_regprocedure('public.psico_somente_insercao()') IS NULL
     OR to_regclass('public.acoes_5w2h') IS NULL THEN
    RAISE EXCEPTION 'faltam a v287 (psico_*) ou caller_pode_editar()/caller_pode_ver_empresa(text)';
  END IF;
END $$;

-- ── 1) Ligação de setores por empresa ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.psico_conciliacao_setor_depara (
  id_depara  text PRIMARY KEY,                    -- PCS-XXXXXXXX
  id_empresa text NOT NULL REFERENCES public.empresas(id_empresa) ON DELETE CASCADE,
  chave_de   text NOT NULL CHECK (btrim(chave_de) <> ''),   -- chaveSetor(sugerirSetorCanonico(nome))
  nome_de    text NOT NULL,
  chave_para text NOT NULL CHECK (btrim(chave_para) <> ''),
  nome_para  text NOT NULL,
  criado_por text NOT NULL DEFAULT lower(nullif(auth.jwt() ->> 'email', '')),
  criado_em  timestamptz NOT NULL DEFAULT now(),
  CHECK (chave_de <> chave_para)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_psico_conc_setor_depara
  ON public.psico_conciliacao_setor_depara (id_empresa, chave_de);
COMMENT ON TABLE public.psico_conciliacao_setor_depara IS
  'Conciliação DRPS/QPS × AEP: setor escrito de outro jeito → o mesmo setor, por empresa. v310.';

-- ── 2) Parecer por cruzamento ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.psico_conciliacao_pareceres (
  id_parecer    text PRIMARY KEY,                 -- PCP-XXXXXXXX
  id_empresa    text NOT NULL REFERENCES public.empresas(id_empresa) ON DELETE CASCADE,
  setor_chave   text NOT NULL CHECK (btrim(setor_chave) <> ''),
  setor_nome    text NOT NULL,
  id_fator      text NOT NULL,
  questionario  text NOT NULL CHECK (questionario IN ('DRPS', 'QPS')),
  decisao       text NOT NULL CHECK (decisao IN ('CONFIRMAR', 'AET', 'DESCARTAR')),
  justificativa text,
  classe        text NOT NULL,                    -- a classe quando o parecer foi dado
  documentos    jsonb NOT NULL DEFAULT '{}',      -- {AEP: id, DRPS: id, QPS: id} usados
  id_acao       text REFERENCES public.acoes_5w2h(id_acao) ON DELETE SET NULL,
  criado_por    text NOT NULL DEFAULT lower(nullif(auth.jwt() ->> 'email', '')),
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_por text NOT NULL DEFAULT lower(nullif(auth.jwt() ->> 'email', '')),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  CHECK (decisao <> 'DESCARTAR' OR btrim(coalesce(justificativa, '')) <> '')
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_psico_conc_parecer
  ON public.psico_conciliacao_pareceres (id_empresa, setor_chave, id_fator, questionario);
COMMENT ON TABLE public.psico_conciliacao_pareceres IS
  'Conciliação DRPS/QPS × AEP: conclusão de cada setor × fator × questionário (CONFIRMAR no PGR, AET ou DESCARTAR com justificativa). v310.';

-- Quem e quando mudou vem do banco, não da tela.
CREATE OR REPLACE FUNCTION public.psico_conciliacao_parecer_carimbo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.atualizado_em := now();
  NEW.atualizado_por := coalesce(lower(nullif(auth.jwt() ->> 'email', '')), NEW.atualizado_por);
  IF TG_OP = 'UPDATE' THEN
    NEW.criado_por := OLD.criado_por;
    NEW.criado_em := OLD.criado_em;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_psico_conciliacao_parecer_carimbo ON public.psico_conciliacao_pareceres;
CREATE TRIGGER trg_psico_conciliacao_parecer_carimbo BEFORE INSERT OR UPDATE ON public.psico_conciliacao_pareceres
  FOR EACH ROW EXECUTE FUNCTION public.psico_conciliacao_parecer_carimbo();

-- ── 3) Fechamento (append-only) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.psico_conciliacao_fechamentos (
  id_fechamento text PRIMARY KEY,                 -- PCF-XXXXXXXX
  id_empresa    text NOT NULL,                    -- sem FK: a foto sobrevive à empresa (como psico_consolidacao_itens)
  fechado_por   text NOT NULL DEFAULT lower(nullif(auth.jwt() ->> 'email', '')),
  fechado_em    timestamptz NOT NULL DEFAULT now(),
  documentos    jsonb NOT NULL DEFAULT '{}',      -- documentos usados (id, título, data)
  regua         jsonb NOT NULL DEFAULT '{}',      -- cortes da régua no momento
  resumo        jsonb NOT NULL DEFAULT '{}',      -- totais por questionário e classe
  itens         jsonb NOT NULL DEFAULT '[]',      -- cruzamentos com divergência + parecer
  observacao    text
);
CREATE INDEX IF NOT EXISTS ix_psico_conc_fechamentos_empresa
  ON public.psico_conciliacao_fechamentos (id_empresa, fechado_em DESC);
COMMENT ON TABLE public.psico_conciliacao_fechamentos IS
  'Conciliação DRPS/QPS × AEP fechada: foto imutável para o histórico do PGR (NR-01). v310.';

CREATE OR REPLACE FUNCTION public.psico_conciliacao_fechamento_carimbo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.fechado_em := now();
  NEW.fechado_por := coalesce(lower(nullif(auth.jwt() ->> 'email', '')), NEW.fechado_por);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_psico_conciliacao_fechamento_carimbo ON public.psico_conciliacao_fechamentos;
CREATE TRIGGER trg_psico_conciliacao_fechamento_carimbo BEFORE INSERT ON public.psico_conciliacao_fechamentos
  FOR EACH ROW EXECUTE FUNCTION public.psico_conciliacao_fechamento_carimbo();

DROP TRIGGER IF EXISTS trg_psico_conciliacao_fechamentos_imutavel ON public.psico_conciliacao_fechamentos;
CREATE TRIGGER trg_psico_conciliacao_fechamentos_imutavel BEFORE UPDATE OR DELETE ON public.psico_conciliacao_fechamentos
  FOR EACH ROW EXECUTE FUNCTION public.psico_somente_insercao();

-- ── 4) RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.psico_conciliacao_setor_depara ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psico_conciliacao_pareceres    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psico_conciliacao_fechamentos  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['psico_conciliacao_setor_depara', 'psico_conciliacao_pareceres'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_sel', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
                    USING (public.psico_caller_interno() AND public.caller_pode_ver_empresa(id_empresa))', t || '_sel', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_ins', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated
                    WITH CHECK (public.caller_pode_editar() AND public.caller_pode_ver_empresa(id_empresa))', t || '_ins', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_upd', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
                    USING (public.caller_pode_editar() AND public.caller_pode_ver_empresa(id_empresa))
                    WITH CHECK (public.caller_pode_editar() AND public.caller_pode_ver_empresa(id_empresa))', t || '_upd', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_del', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated
                    USING (public.caller_pode_editar() AND public.caller_pode_ver_empresa(id_empresa))', t || '_del', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS psico_conciliacao_fechamentos_sel ON public.psico_conciliacao_fechamentos;
CREATE POLICY psico_conciliacao_fechamentos_sel ON public.psico_conciliacao_fechamentos
  FOR SELECT TO authenticated
  USING (public.psico_caller_interno() AND public.caller_pode_ver_empresa(id_empresa));
DROP POLICY IF EXISTS psico_conciliacao_fechamentos_ins ON public.psico_conciliacao_fechamentos;
CREATE POLICY psico_conciliacao_fechamentos_ins ON public.psico_conciliacao_fechamentos
  FOR INSERT TO authenticated
  WITH CHECK (public.caller_pode_editar() AND public.caller_pode_ver_empresa(id_empresa));
REVOKE ALL ON public.psico_conciliacao_fechamentos FROM anon, authenticated;
GRANT SELECT, INSERT ON public.psico_conciliacao_fechamentos TO authenticated;

NOTIFY pgrst, 'reload schema';
