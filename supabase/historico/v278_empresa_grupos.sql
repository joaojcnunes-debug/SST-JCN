-- v278 (JCN) — Grupos de empresas (matriz + filiais)
-- Replicado do Painel SST (v282, commit 6a3e4995, 2026-10-07), sem a trava de
-- banco do painel e sem schema_migrations (o JCN não usa).
--
-- ORIGEM
--   Pedido de 07/10/2026: empresas com mais de um CNPJ ficam juntas num grupo, com a
--   matriz como principal e as demais como filiais (o SGG faz isso em Empresas ›
--   Configurações › Grupo + "Tipo de Empresa: Matriz/Filial"). Decisões dele:
--   • matriz/filial explícito em cada empresa do grupo;
--   • o grupo pode juntar empresas de unidades diferentes — quem é de outra unidade
--     APARECE na lista do grupo (nome, CNPJ, unidade), mas sem acesso aos documentos;
--   • começa do zero (nada importado do SGG);
--   • cria/edita grupo quem edita empresa e faz documento = caller_pode_editar().
--
-- O QUE FAZ
--   1) public.empresa_grupos (id, nome único sem diferenciar caixa, descrição);
--   2) empresas.id_grupo + empresas.papel_grupo ('MATRIZ'|'FILIAL'), os dois juntos
--      ou nenhum, e no máximo UMA matriz por grupo;
--   3) empresa_grupos_membros(): todas as empresas com grupo, de TODAS as unidades,
--      com a flag `visivel` (= a RLS de empresas deixaria ver). É a única porta para
--      o nome de empresa de outra unidade — e só devolve dado de cadastro, nada de
--      documento;
--   4) empresa_grupo_definir_matriz(): troca a matriz (rebaixa a antiga para filial
--      mesmo se ela for de outra unidade — sem isso o índice único travaria a troca);
--   5) empresa_grupo_excluir(): desfaz o grupo (as empresas ficam sem grupo) e apaga.
--   A auditoria liga sozinha na tabela nova (event trigger da v255).
--
-- REAPLICAR: idempotente.
-- ROLLBACK: scripts/sql/v278_empresa_grupos_rollback.sql

BEGIN;

DO $$ BEGIN
  IF to_regprocedure('public.caller_pode_editar()') IS NULL
     OR to_regprocedure('public.caller_pode_ver_empresa(text)') IS NULL THEN
    RAISE EXCEPTION 'faltam caller_pode_editar()/caller_pode_ver_empresa(text)';
  END IF;
END $$;

-- ── 1) Grupos ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.empresa_grupos (
  id_grupo    text PRIMARY KEY,
  nome        text NOT NULL CHECK (btrim(nome) <> ''),
  descricao   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  text DEFAULT lower(nullif(auth.jwt() ->> 'email', '')),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_empresa_grupos_nome
  ON public.empresa_grupos (lower(btrim(nome)));

COMMENT ON TABLE public.empresa_grupos IS
  'Grupos de empresas (matriz + filiais). v278 JCN (v282 painel). Membros em empresas.id_grupo/papel_grupo.';

ALTER TABLE public.empresa_grupos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS empresa_grupos_sel ON public.empresa_grupos;
CREATE POLICY empresa_grupos_sel ON public.empresa_grupos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS empresa_grupos_ins ON public.empresa_grupos;
CREATE POLICY empresa_grupos_ins ON public.empresa_grupos
  FOR INSERT TO authenticated WITH CHECK (public.caller_pode_editar());

DROP POLICY IF EXISTS empresa_grupos_upd ON public.empresa_grupos;
CREATE POLICY empresa_grupos_upd ON public.empresa_grupos
  FOR UPDATE TO authenticated
  USING (public.caller_pode_editar()) WITH CHECK (public.caller_pode_editar());

-- Sem policy de DELETE: excluir é só pela função (que desfaz o grupo antes).
DROP POLICY IF EXISTS empresa_grupos_del ON public.empresa_grupos;

REVOKE ALL ON public.empresa_grupos FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.empresa_grupos TO authenticated;

-- ── 2) Membros: empresas.id_grupo + papel_grupo ─────────────────────────────
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS id_grupo text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS papel_grupo text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'empresas_id_grupo_fkey') THEN
    ALTER TABLE public.empresas ADD CONSTRAINT empresas_id_grupo_fkey
      FOREIGN KEY (id_grupo) REFERENCES public.empresa_grupos(id_grupo) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'empresas_papel_grupo_chk') THEN
    ALTER TABLE public.empresas ADD CONSTRAINT empresas_papel_grupo_chk
      CHECK (papel_grupo IS NULL OR papel_grupo IN ('MATRIZ', 'FILIAL'));
  END IF;
  -- Os dois juntos ou nenhum: empresa em grupo sempre diz se é matriz ou filial.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'empresas_grupo_papel_juntos_chk') THEN
    ALTER TABLE public.empresas ADD CONSTRAINT empresas_grupo_papel_juntos_chk
      CHECK ((id_grupo IS NULL) = (papel_grupo IS NULL));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_empresas_id_grupo
  ON public.empresas (id_grupo) WHERE id_grupo IS NOT NULL;

-- No máximo uma matriz por grupo.
CREATE UNIQUE INDEX IF NOT EXISTS ux_empresas_matriz_por_grupo
  ON public.empresas (id_grupo) WHERE papel_grupo = 'MATRIZ';

COMMENT ON COLUMN public.empresas.id_grupo IS 'Grupo da empresa (empresa_grupos). v278.';
COMMENT ON COLUMN public.empresas.papel_grupo IS 'MATRIZ ou FILIAL dentro do grupo; nulo sem grupo. v278.';

-- ── 3) Quem está em cada grupo, de todas as unidades ────────────────────────
CREATE OR REPLACE FUNCTION public.empresa_grupos_membros()
RETURNS TABLE (
  id_empresa    text,
  id_grupo      text,
  papel_grupo   text,
  nome_empresa  text,
  razao_social  text,
  nome_fantasia text,
  cnpj          text,
  id_unidade    text,
  unidade_nome  text,
  status        text,
  visivel       boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id_empresa, e.id_grupo, e.papel_grupo, e.nome_empresa, e.razao_social,
         e.nome_fantasia, e.cnpj, e.id_unidade, u.nome, e.status,
         public.caller_pode_ver_empresa(e.id_empresa)
    FROM public.empresas e
    LEFT JOIN public.unidades u ON u.id_unidade = e.id_unidade
   WHERE e.id_grupo IS NOT NULL
     -- Só a equipe interna (o portal do cliente não enxerga a carteira).
     AND EXISTS (
       SELECT 1 FROM public.usuarios x
        WHERE lower(x.email) = lower(auth.jwt() ->> 'email')
          AND x.ativo_sistema = true
          AND x.perfil IS DISTINCT FROM 'Cliente'
     )
   ORDER BY e.id_grupo, (e.papel_grupo = 'MATRIZ') DESC, e.nome_empresa;
$$;

REVOKE ALL ON FUNCTION public.empresa_grupos_membros() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.empresa_grupos_membros() TO authenticated;

-- ── 4) Trocar a matriz do grupo ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.empresa_grupo_definir_matriz(p_id_grupo text, p_id_empresa text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.caller_pode_editar() THEN
    RAISE EXCEPTION 'sem permissão para editar grupos' USING ERRCODE = '42501';
  END IF;
  IF NOT public.caller_pode_ver_empresa(p_id_empresa) THEN
    RAISE EXCEPTION 'a empresa é de outra unidade' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.empresas WHERE id_empresa = p_id_empresa AND id_grupo = p_id_grupo) THEN
    RAISE EXCEPTION 'a empresa não está neste grupo';
  END IF;
  UPDATE public.empresas SET papel_grupo = 'FILIAL'
   WHERE id_grupo = p_id_grupo AND papel_grupo = 'MATRIZ' AND id_empresa <> p_id_empresa;
  UPDATE public.empresas SET papel_grupo = 'MATRIZ'
   WHERE id_empresa = p_id_empresa;
END $$;

REVOKE ALL ON FUNCTION public.empresa_grupo_definir_matriz(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.empresa_grupo_definir_matriz(text, text) TO authenticated;

-- ── 5) Excluir o grupo (as empresas ficam sem grupo; nada delas é apagado) ──
CREATE OR REPLACE FUNCTION public.empresa_grupo_excluir(p_id_grupo text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF NOT public.caller_pode_editar() THEN
    RAISE EXCEPTION 'sem permissão para excluir grupos' USING ERRCODE = '42501';
  END IF;
  UPDATE public.empresas SET id_grupo = NULL, papel_grupo = NULL WHERE id_grupo = p_id_grupo;
  GET DIAGNOSTICS n = ROW_COUNT;
  DELETE FROM public.empresa_grupos WHERE id_grupo = p_id_grupo;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.empresa_grupo_excluir(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.empresa_grupo_excluir(text) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
