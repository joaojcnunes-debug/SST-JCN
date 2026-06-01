-- v60: Extintores por setor — NR-23 Proteção Contra Incêndios
CREATE TABLE IF NOT EXISTS extintores (
  id_extintor         TEXT PRIMARY KEY,
  id_inspecao         TEXT NOT NULL REFERENCES inspecoes(id_inspecao) ON DELETE CASCADE,
  id_empresa          TEXT NOT NULL REFERENCES empresas(id_empresa),
  id_setor            TEXT REFERENCES setores(id_setor) ON DELETE SET NULL,
  tipo_agente         TEXT NOT NULL,
  capacidade          TEXT,
  numero_identificacao TEXT,
  localizacao         TEXT,
  data_validade       DATE,
  status              TEXT,
  observacoes         TEXT,
  ordem               INT NOT NULL DEFAULT 99,
  ativo               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ
);

ALTER TABLE extintores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "extintores_auth" ON extintores;
CREATE POLICY "extintores_auth" ON extintores FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS extintores_inspecao_idx ON extintores(id_inspecao, ordem);
