-- ============================================================
-- v25 — RLS simplificada para drps_texto_padrao
-- ============================================================
-- A v24 usou auth.email() (funcao que pode nao existir em versoes
-- mais antigas do Postgres/Supabase). As outras tabelas DRPS
-- (drps_respondentes, drps_probabilidades, drps_revisao etc) usam
-- o padrao mais simples: qualquer authenticated pode ler/escrever.
-- Aqui alinhamos drps_texto_padrao a esse padrao.
-- ============================================================

DROP POLICY IF EXISTS "drps_texto_padrao_select" ON public.drps_texto_padrao;
DROP POLICY IF EXISTS "drps_texto_padrao_insert" ON public.drps_texto_padrao;
DROP POLICY IF EXISTS "drps_texto_padrao_update" ON public.drps_texto_padrao;
DROP POLICY IF EXISTS "drps_texto_padrao_delete" ON public.drps_texto_padrao;

CREATE POLICY "auth read drps_texto_padrao"
    ON public.drps_texto_padrao
    FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "auth write drps_texto_padrao"
    ON public.drps_texto_padrao
    FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);
