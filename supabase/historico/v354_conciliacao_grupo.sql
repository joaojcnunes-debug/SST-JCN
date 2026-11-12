-- v354 — Conciliação DRPS/QPS × AEP por GRUPO de empresas (12/11/2026, 0.3.285).
--
-- POR QUÊ: pedido do João. No grupo econômico os trabalhadores transitam entre as empresas, e muitas vezes
-- um CNPJ tem só a AEP e outro só o questionário (ex.: matriz e filiais da mesma rede). Por empresa, cada um
-- fica "Só AEP" ou "Só questionário". Por grupo, a AEP mais recente de cada empresa e o DRPS/QPS mais recente
-- de cada empresa entram juntos e são comparados setor × fator, com a mesma régua da conciliação por empresa.
--
-- O QUE FAZ (o mesmo desenho da v310/v324/v326, com id_grupo no lugar de id_empresa):
--   1) psico_caller_ve_grupo(id_grupo): usuário interno que enxerga TODAS as empresas do grupo (e o grupo tem
--      ao menos uma). Quem não vê uma das empresas não vê nem grava a conciliação do grupo.
--   2) psico_conciliacao_grupo_setor_depara — ligação de setores escritos de outro jeito, por grupo.
--   3) psico_conciliacao_grupo_pareceres — parecer por setor × fator × questionário (DRPS, QPS ou AEP), com
--      id_acoes text[]: o parecer do grupo cria uma ação 5W2H em cada empresa do grupo que tem o setor.
--   4) psico_conciliacao_grupo_fechamentos — foto imutável (só inserção), com as empresas do momento e os
--      documentos usados de cada uma (documentos = lista, não um por origem).
--   5) psico_conciliacao_grupo_reaberturas — reabrir a última, com motivo (só inserção).
--   RLS: lê psico_caller_ve_grupo; escreve caller_pode_editar() e psico_caller_ve_grupo.
--   Só cria objetos; nenhum dado existente muda. Grupos do tipo CONSOLIDACAO (seleção salva) não têm membros
--   em empresas.id_grupo, então não passam em psico_caller_ve_grupo.
--
-- REAPLICAR: idempotente. ROLLBACK: scripts/sql/v354_conciliacao_grupo_rollback.sql
begin;

DO $$ BEGIN
  IF to_regprocedure('public.caller_pode_editar()') IS NULL
     OR to_regprocedure('public.caller_pode_ver_empresa(text)') IS NULL
     OR to_regprocedure('public.psico_caller_interno()') IS NULL
     OR to_regprocedure('public.psico_somente_insercao()') IS NULL
     OR to_regprocedure('public.psico_conciliacao_parecer_carimbo()') IS NULL
     OR to_regprocedure('public.psico_conciliacao_fechamento_carimbo()') IS NULL
     OR to_regclass('public.empresa_grupos') IS NULL THEN
    RAISE EXCEPTION 'faltam a v287/v310 (psico_*) ou empresa_grupos (v278)';
  END IF;
END $$;

-- ── 1) Quem enxerga o grupo ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.psico_caller_ve_grupo(p_id_grupo text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.psico_caller_interno()
     AND EXISTS (SELECT 1 FROM public.empresas e WHERE e.id_grupo = p_id_grupo)
     AND NOT EXISTS (
       SELECT 1 FROM public.empresas e
        WHERE e.id_grupo = p_id_grupo AND NOT coalesce(public.caller_pode_ver_empresa(e.id_empresa), false)
     );
$$;
REVOKE ALL ON FUNCTION public.psico_caller_ve_grupo(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.psico_caller_ve_grupo(text) TO authenticated;

-- ── 2) Ligação de setores por grupo ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.psico_conciliacao_grupo_setor_depara (
  id_depara  text PRIMARY KEY,                    -- PGS-XXXXXXXX
  id_grupo   text NOT NULL REFERENCES public.empresa_grupos(id_grupo) ON DELETE CASCADE,
  chave_de   text NOT NULL CHECK (btrim(chave_de) <> ''),
  nome_de    text NOT NULL,
  chave_para text NOT NULL CHECK (btrim(chave_para) <> ''),
  nome_para  text NOT NULL,
  criado_por text NOT NULL DEFAULT lower(nullif(auth.jwt() ->> 'email', '')),
  criado_em  timestamptz NOT NULL DEFAULT now(),
  CHECK (chave_de <> chave_para)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_psico_conc_grupo_setor_depara
  ON public.psico_conciliacao_grupo_setor_depara (id_grupo, chave_de);
COMMENT ON TABLE public.psico_conciliacao_grupo_setor_depara IS
  'Conciliação por grupo: setor escrito de outro jeito → o mesmo setor, por grupo. v354.';

-- ── 3) Parecer por cruzamento, por grupo ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.psico_conciliacao_grupo_pareceres (
  id_parecer     text PRIMARY KEY,                -- PGP-XXXXXXXX
  id_grupo       text NOT NULL REFERENCES public.empresa_grupos(id_grupo) ON DELETE CASCADE,
  setor_chave    text NOT NULL CHECK (btrim(setor_chave) <> ''),
  setor_nome     text NOT NULL,
  id_fator       text NOT NULL,
  questionario   text NOT NULL CHECK (questionario IN ('DRPS', 'QPS', 'AEP')),
  decisao        text NOT NULL CHECK (decisao IN ('CONFIRMAR', 'AET', 'DESCARTAR')),
  justificativa  text,
  classe         text NOT NULL,
  documentos     jsonb NOT NULL DEFAULT '[]',     -- ids dos documentos usados (de todas as empresas)
  id_acoes       text[] NOT NULL DEFAULT '{}',    -- uma ação 5W2H por empresa que tem o setor
  criado_por     text NOT NULL DEFAULT lower(nullif(auth.jwt() ->> 'email', '')),
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_por text NOT NULL DEFAULT lower(nullif(auth.jwt() ->> 'email', '')),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  CHECK (decisao <> 'DESCARTAR' OR btrim(coalesce(justificativa, '')) <> '')
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_psico_conc_grupo_parecer
  ON public.psico_conciliacao_grupo_pareceres (id_grupo, setor_chave, id_fator, questionario);
COMMENT ON TABLE public.psico_conciliacao_grupo_pareceres IS
  'Conciliação por grupo: conclusão de cada setor × fator × questionário; id_acoes = ações 5W2H criadas nas empresas. v354.';

DROP TRIGGER IF EXISTS trg_psico_conc_grupo_parecer_carimbo ON public.psico_conciliacao_grupo_pareceres;
CREATE TRIGGER trg_psico_conc_grupo_parecer_carimbo BEFORE INSERT OR UPDATE ON public.psico_conciliacao_grupo_pareceres
  FOR EACH ROW EXECUTE FUNCTION public.psico_conciliacao_parecer_carimbo();

-- ── 4) Fechamento por grupo (só inserção) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.psico_conciliacao_grupo_fechamentos (
  id_fechamento text PRIMARY KEY,                 -- PGF-XXXXXXXX
  id_grupo      text NOT NULL,                    -- sem FK: a foto sobrevive ao grupo
  nome_grupo    text NOT NULL,
  empresas      jsonb NOT NULL DEFAULT '[]',      -- [{id_empresa, nome, cnpj}] do momento
  fechado_por   text NOT NULL DEFAULT lower(nullif(auth.jwt() ->> 'email', '')),
  fechado_em    timestamptz NOT NULL DEFAULT now(),
  documentos    jsonb NOT NULL DEFAULT '[]',      -- [{origem, id, titulo, data, id_empresa}]
  regua         jsonb NOT NULL DEFAULT '{}',
  resumo        jsonb NOT NULL DEFAULT '{}',
  itens         jsonb NOT NULL DEFAULT '[]',
  observacao    text
);
CREATE INDEX IF NOT EXISTS ix_psico_conc_grupo_fechamentos_grupo
  ON public.psico_conciliacao_grupo_fechamentos (id_grupo, fechado_em DESC);
COMMENT ON TABLE public.psico_conciliacao_grupo_fechamentos IS
  'Conciliação por grupo fechada: foto imutável para o histórico do PGR (NR-01). v354.';

DROP TRIGGER IF EXISTS trg_psico_conc_grupo_fechamento_carimbo ON public.psico_conciliacao_grupo_fechamentos;
CREATE TRIGGER trg_psico_conc_grupo_fechamento_carimbo BEFORE INSERT ON public.psico_conciliacao_grupo_fechamentos
  FOR EACH ROW EXECUTE FUNCTION public.psico_conciliacao_fechamento_carimbo();
DROP TRIGGER IF EXISTS trg_psico_conc_grupo_fechamentos_imutavel ON public.psico_conciliacao_grupo_fechamentos;
CREATE TRIGGER trg_psico_conc_grupo_fechamentos_imutavel BEFORE UPDATE OR DELETE ON public.psico_conciliacao_grupo_fechamentos
  FOR EACH ROW EXECUTE FUNCTION public.psico_somente_insercao();

-- ── 5) Reabertura por grupo (só inserção) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.psico_conciliacao_grupo_reaberturas (
  id_reabertura text PRIMARY KEY,                 -- PGR-XXXXXXXX
  id_fechamento text NOT NULL UNIQUE REFERENCES public.psico_conciliacao_grupo_fechamentos(id_fechamento),
  id_grupo      text NOT NULL,
  motivo        text NOT NULL CHECK (btrim(motivo) <> ''),
  reaberto_por  text NOT NULL DEFAULT lower(nullif(auth.jwt() ->> 'email', '')),
  reaberto_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_psico_conc_grupo_reaberturas_grupo
  ON public.psico_conciliacao_grupo_reaberturas (id_grupo, reaberto_em DESC);
COMMENT ON TABLE public.psico_conciliacao_grupo_reaberturas IS
  'Conciliação por grupo reaberta: não altera a foto do fechamento. Só inserção. v354.';

-- Só a última conciliação do grupo, ainda não reaberta, pode ser reaberta.
CREATE OR REPLACE FUNCTION public.psico_conc_grupo_reabertura_valida()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_ultimo text;
BEGIN
  SELECT f.id_fechamento INTO v_ultimo
    FROM public.psico_conciliacao_grupo_fechamentos f
   WHERE f.id_grupo = NEW.id_grupo
   ORDER BY f.fechado_em DESC LIMIT 1;
  IF v_ultimo IS DISTINCT FROM NEW.id_fechamento THEN
    RAISE EXCEPTION 'só a última conciliação fechada do grupo pode ser reaberta' USING errcode = '23514';
  END IF;
  NEW.reaberto_em := now();
  NEW.reaberto_por := coalesce(lower(nullif(auth.jwt() ->> 'email', '')), NEW.reaberto_por);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_psico_conc_grupo_reabertura_valida ON public.psico_conciliacao_grupo_reaberturas;
CREATE TRIGGER trg_psico_conc_grupo_reabertura_valida BEFORE INSERT ON public.psico_conciliacao_grupo_reaberturas
  FOR EACH ROW EXECUTE FUNCTION public.psico_conc_grupo_reabertura_valida();
DROP TRIGGER IF EXISTS trg_psico_conc_grupo_reaberturas_imutavel ON public.psico_conciliacao_grupo_reaberturas;
CREATE TRIGGER trg_psico_conc_grupo_reaberturas_imutavel BEFORE UPDATE OR DELETE ON public.psico_conciliacao_grupo_reaberturas
  FOR EACH ROW EXECUTE FUNCTION public.psico_somente_insercao();

-- ── 6) RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.psico_conciliacao_grupo_setor_depara ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psico_conciliacao_grupo_pareceres    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psico_conciliacao_grupo_fechamentos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psico_conciliacao_grupo_reaberturas  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['psico_conciliacao_grupo_setor_depara', 'psico_conciliacao_grupo_pareceres'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_sel', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
                    USING (public.psico_caller_ve_grupo(id_grupo))', t || '_sel', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_ins', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated
                    WITH CHECK (public.caller_pode_editar() AND public.psico_caller_ve_grupo(id_grupo))', t || '_ins', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_upd', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
                    USING (public.caller_pode_editar() AND public.psico_caller_ve_grupo(id_grupo))
                    WITH CHECK (public.caller_pode_editar() AND public.psico_caller_ve_grupo(id_grupo))', t || '_upd', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_del', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated
                    USING (public.caller_pode_editar() AND public.psico_caller_ve_grupo(id_grupo))', t || '_del', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['psico_conciliacao_grupo_fechamentos', 'psico_conciliacao_grupo_reaberturas'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_sel', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
                    USING (public.psico_caller_ve_grupo(id_grupo))', t || '_sel', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_ins', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated
                    WITH CHECK (public.caller_pode_editar() AND public.psico_caller_ve_grupo(id_grupo))', t || '_ins', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT ON public.%I TO authenticated', t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

commit;
