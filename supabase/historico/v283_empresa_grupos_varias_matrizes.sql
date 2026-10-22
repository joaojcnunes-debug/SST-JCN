-- v283 (JCN) — Grupos de empresas: o grupo aceita MAIS DE UMA matriz.
-- Replicado do Painel SST (v285, commit d9ffd7a0, v0.3.728), sem a trava de banco
-- do painel e sem schema_migrations.
--
-- POR QUÊ: condomínios administrados pela mesma imobiliária ou contabilidade são
-- CNPJs próprios, todos matriz (ordem 0001); o grupo organiza o processo, não diz
-- "um CNPJ com filiais". A v278 tinha o índice "no máximo 1 matriz por grupo".
--
-- O QUE FAZ
--   1) DROP do índice único ux_empresas_matriz_por_grupo;
--   2) empresa_grupo_definir_matriz() passa a só PROMOVER a empresa (não rebaixa
--      mais a matriz antiga). Para virar filial, a tela grava papel_grupo = 'FILIAL'.
--   Medido em 22/10/2026: nenhum grupo com 2+ matrizes; nada muda em dados.
--
-- REAPLICAR: idempotente.
-- ROLLBACK: scripts/sql/v283_empresa_grupos_varias_matrizes_rollback.sql

DROP INDEX IF EXISTS public.ux_empresas_matriz_por_grupo;

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
  -- v283: o grupo pode ter várias matrizes; as outras ficam como estão.
  UPDATE public.empresas SET papel_grupo = 'MATRIZ'
   WHERE id_empresa = p_id_empresa;
END $$;

REVOKE ALL ON FUNCTION public.empresa_grupo_definir_matriz(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.empresa_grupo_definir_matriz(text, text) TO authenticated;

COMMENT ON COLUMN public.empresas.papel_grupo IS
  'MATRIZ ou FILIAL dentro do grupo; nulo sem grupo. v278; v283: várias matrizes por grupo.';

NOTIFY pgrst, 'reload schema';
