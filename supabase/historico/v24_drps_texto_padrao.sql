-- ============================================================
-- v24 — DRPS Texto Padrao (capitulos editaveis para o PDF)
-- ============================================================
-- Tabela global (nao vinculada a empresa/relatorio) com capitulos de
-- texto padrao que entram no relatorio formal de Analise e Avaliacao.
-- Cada capitulo tem titulo, conteudo (rich text simples) e ordem.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.drps_texto_padrao (
    id_capitulo TEXT PRIMARY KEY,
    ordem INTEGER NOT NULL DEFAULT 0,
    titulo TEXT NOT NULL,
    conteudo TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_drps_texto_padrao_ordem
    ON public.drps_texto_padrao(ordem)
    WHERE ativo = TRUE;

-- RLS: leitura para autenticados, escrita so para Admin/Tecnico
ALTER TABLE public.drps_texto_padrao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drps_texto_padrao_select" ON public.drps_texto_padrao;
CREATE POLICY "drps_texto_padrao_select"
    ON public.drps_texto_padrao
    FOR SELECT
    TO authenticated
    USING (TRUE);

DROP POLICY IF EXISTS "drps_texto_padrao_insert" ON public.drps_texto_padrao;
CREATE POLICY "drps_texto_padrao_insert"
    ON public.drps_texto_padrao
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.usuarios
            WHERE email = auth.email()
              AND perfil IN ('Admin', 'Tecnico')
        )
    );

DROP POLICY IF EXISTS "drps_texto_padrao_update" ON public.drps_texto_padrao;
CREATE POLICY "drps_texto_padrao_update"
    ON public.drps_texto_padrao
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios
            WHERE email = auth.email()
              AND perfil IN ('Admin', 'Tecnico')
        )
    );

DROP POLICY IF EXISTS "drps_texto_padrao_delete" ON public.drps_texto_padrao;
CREATE POLICY "drps_texto_padrao_delete"
    ON public.drps_texto_padrao
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios
            WHERE email = auth.email()
              AND perfil = 'Admin'
        )
    );

COMMENT ON TABLE public.drps_texto_padrao
    IS 'Capitulos de texto padrao do relatorio DRPS (introducao, metodologia, conclusao etc).';
