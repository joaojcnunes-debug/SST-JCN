-- ─── AEP – Análise Ergonômica Preliminar ─────────────────────────────────────
-- Tabelas:
--   aep_relatorios      — documento principal (empresa, setores JSONB, dados técnicos)
--   aep_textos_padrao   — capítulos editáveis e fixos do laudo PDF

-- ── 1. Relatórios AEP ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS aep_relatorios (
  id_relatorio            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  id_empresa              text        NOT NULL REFERENCES empresas(id_empresa) ON DELETE CASCADE,
  status                  text        NOT NULL DEFAULT 'RASCUNHO'
                                      CHECK (status IN ('RASCUNHO', 'CONCLUIDO')),
  setores                 jsonb       NOT NULL DEFAULT '[]',
  responsavel_elaboracao  text        NOT NULL DEFAULT '',
  titulo_profissional     text        NOT NULL DEFAULT '',
  registro_profissional   text        NOT NULL DEFAULT '',
  data_elaboracao         date,
  endereco_empresa        text,
  conclusao               text        NOT NULL DEFAULT '',
  usuario                 uuid        REFERENCES auth.users(id),
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

ALTER TABLE aep_relatorios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autenticado pode ler aep_relatorios"
  ON aep_relatorios FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "autenticado pode criar aep_relatorios"
  ON aep_relatorios FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "autenticado pode editar aep_relatorios"
  ON aep_relatorios FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "admin pode excluir aep_relatorios"
  ON aep_relatorios FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id_usuario = auth.uid() AND perfil = 'Admin'
    )
  );

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_aep_relatorios_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_aep_relatorios_updated_at
  BEFORE UPDATE ON aep_relatorios
  FOR EACH ROW EXECUTE FUNCTION update_aep_relatorios_updated_at();

-- ── 2. Textos Padrão AEP ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS aep_textos_padrao (
  id_capitulo   uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo        text        NOT NULL,
  conteudo      text,
  tipo          text        NOT NULL DEFAULT 'editavel'
                            CHECK (tipo IN ('fixo', 'editavel')),
  slug_fixo     text,
  mostrar       boolean     NOT NULL DEFAULT true,
  ordem         integer     NOT NULL DEFAULT 0,
  ordem_global  integer     NOT NULL DEFAULT 0,
  orientacao    text        DEFAULT 'retrato'
                            CHECK (orientacao IN ('retrato', 'paisagem')),
  bg_imagem_url text,
  caixas_texto  jsonb,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE aep_textos_padrao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autenticado pode ler aep_textos_padrao"
  ON aep_textos_padrao FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "admin pode gerir aep_textos_padrao"
  ON aep_textos_padrao FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id_usuario = auth.uid() AND perfil = 'Admin'
    )
  );

-- ── 3. Módulo AEP em empresas_modulos_habilitados ────────────────────────────
-- Estrutura JSONB: modulos_habilitados TEXT[]. Não requer migration separada —
-- basta inserir 'aep' no array de módulos da empresa desejada via painel admin.
