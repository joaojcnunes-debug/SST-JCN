-- ─── AET — 13 Fatores Psicossociais ──────────────────────────────────────────
-- Tabelas:
--   aet_13fatores_config      — cadastro dos 13 fatores (nome, descrição, etc.)
--   aet_13fatores_perguntas   — perguntas QPS por fator
--   aet_13fatores_semaforo    — zonas de risco com prazos PGR
--   aet_laudo_qps_meta        — metadados da aplicação QPS por laudo
--   aet_laudo_fatores_psi     — avaliação por fator por laudo (média, zona, obs)
--   aet_laudo_qps_respostas   — respostas individuais por setor/fator/pergunta

-- ── 1. Configuração dos 13 Fatores ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS aet_13fatores_config (
  codigo        text PRIMARY KEY,            -- F01 … F13
  nome          text NOT NULL,
  descricao     text,
  categoria     text,
  ordem         integer NOT NULL DEFAULT 0,
  ativo         boolean NOT NULL DEFAULT true,
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE aet_13fatores_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autenticado pode ler 13fatores_config"
  ON aet_13fatores_config FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "admin pode gerir 13fatores_config"
  ON aet_13fatores_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND perfil = 'Admin'
    )
  );

-- ── 2. Perguntas QPS ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS aet_13fatores_perguntas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_fator  text NOT NULL REFERENCES aet_13fatores_config(codigo) ON DELETE CASCADE,
  ordem         integer NOT NULL,
  texto         text NOT NULL,
  logica        text NOT NULL CHECK (logica IN ('direta', 'invertida')) DEFAULT 'direta',
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (codigo_fator, ordem)
);

ALTER TABLE aet_13fatores_perguntas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autenticado pode ler 13fatores_perguntas"
  ON aet_13fatores_perguntas FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "admin pode gerir 13fatores_perguntas"
  ON aet_13fatores_perguntas FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND perfil = 'Admin'
    )
  );

-- ── 3. Semáforo de Zonas ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS aet_13fatores_semaforo (
  id            text PRIMARY KEY,            -- verde / amarela / laranja / vermelha
  rotulo        text NOT NULL,
  nivel_pgr     text NOT NULL,
  prazo_texto   text NOT NULL,
  cor_hex       text NOT NULL DEFAULT '#000000',
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE aet_13fatores_semaforo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autenticado pode ler 13fatores_semaforo"
  ON aet_13fatores_semaforo FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "admin pode gerir 13fatores_semaforo"
  ON aet_13fatores_semaforo FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND perfil = 'Admin'
    )
  );

-- ── 4. Metadados da Aplicação QPS ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS aet_laudo_qps_meta (
  id_relatorio       uuid PRIMARY KEY REFERENCES aet_relatorios(id_relatorio) ON DELETE CASCADE,
  n_respondentes     integer,
  total_elegivel     integer,
  periodo_inicio     date,
  periodo_fim        date,
  modo_aplicacao     text,
  tecnico_aplicador  text,
  observacao_geral   text,
  updated_at         timestamptz DEFAULT now()
);

ALTER TABLE aet_laudo_qps_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autenticado pode ler laudo_qps_meta"
  ON aet_laudo_qps_meta FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "autenticado pode gravar laudo_qps_meta"
  ON aet_laudo_qps_meta FOR ALL
  USING (auth.role() = 'authenticated');

-- ── 5. Avaliação por Fator (por Laudo) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS aet_laudo_fatores_psi (
  id_relatorio      uuid NOT NULL REFERENCES aet_relatorios(id_relatorio) ON DELETE CASCADE,
  codigo_fator      text NOT NULL REFERENCES aet_13fatores_config(codigo) ON DELETE CASCADE,
  avaliado          boolean NOT NULL DEFAULT false,
  media             numeric(4,2),
  pct_zona_risco    numeric(5,2),
  pergunta_critica  text,
  observacao        text,
  zona              text CHECK (zona IN ('verde', 'amarela', 'laranja', 'vermelha')),
  updated_at        timestamptz DEFAULT now(),
  PRIMARY KEY (id_relatorio, codigo_fator)
);

ALTER TABLE aet_laudo_fatores_psi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autenticado pode ler laudo_fatores_psi"
  ON aet_laudo_fatores_psi FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "autenticado pode gravar laudo_fatores_psi"
  ON aet_laudo_fatores_psi FOR ALL
  USING (auth.role() = 'authenticated');

-- ── 6. Respostas individuais por Setor / Fator / Pergunta ────────────────────

CREATE TABLE IF NOT EXISTS aet_laudo_qps_respostas (
  id_relatorio    uuid NOT NULL REFERENCES aet_relatorios(id_relatorio) ON DELETE CASCADE,
  id_setor        uuid NOT NULL,
  codigo_fator    text NOT NULL REFERENCES aet_13fatores_config(codigo) ON DELETE CASCADE,
  pergunta_ordem  integer NOT NULL,
  resposta        integer NOT NULL CHECK (resposta BETWEEN 1 AND 5),
  updated_at      timestamptz DEFAULT now(),
  PRIMARY KEY (id_relatorio, id_setor, codigo_fator, pergunta_ordem)
);

ALTER TABLE aet_laudo_qps_respostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autenticado pode ler laudo_qps_respostas"
  ON aet_laudo_qps_respostas FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "autenticado pode gravar laudo_qps_respostas"
  ON aet_laudo_qps_respostas FOR ALL
  USING (auth.role() = 'authenticated');

-- ── 7. Seed — Semáforo padrão ────────────────────────────────────────────────

INSERT INTO aet_13fatores_semaforo (id, rotulo, nivel_pgr, prazo_texto, cor_hex)
VALUES
  ('verde',    'Verde — Satisfatório', 'Tolerável',  '12 meses', '#22c55e'),
  ('amarela',  'Amarela — Atenção',    'Moderado',   '6 meses',  '#eab308'),
  ('laranja',  'Laranja — Elevado',    'Alto',       '90 dias',  '#f97316'),
  ('vermelha', 'Vermelha — Crítico',   'Muito Alto', '30 dias',  '#ef4444')
ON CONFLICT (id) DO NOTHING;

-- ── 8. Seed — 13 Fatores (configuração padrão) ───────────────────────────────

INSERT INTO aet_13fatores_config (codigo, nome, descricao, categoria, ordem)
VALUES
  ('F01', 'Exigências quantitativas',        'Volume de trabalho e tempo disponível para realizá-lo.',                                          'Demandas',         1),
  ('F02', 'Ritmo de trabalho',               'Velocidade e intensidade exigidas na execução das tarefas.',                                      'Demandas',         2),
  ('F03', 'Exigências emocionais',           'Situações que demandam controle emocional ou exposição a sofrimento alheio.',                     'Demandas',         3),
  ('F04', 'Autonomia',                       'Grau de controle sobre o próprio trabalho, métodos e sequência de tarefas.',                      'Organização',      4),
  ('F05', 'Demandas psicológicas',           'Exigências cognitivas como atenção, memória e tomada de decisão.',                                'Demandas',         5),
  ('F06', 'Crescimento e desenvolvimento',   'Possibilidade de aprendizado, uso de habilidades e progressão profissional.',                     'Desenvolvimento',  6),
  ('F07', 'Reconhecimento e recompensa',     'Percepção de reconhecimento por gestores, colegas e pela organização.',                           'Relações',         7),
  ('F08', 'Envolvimento e influência',       'Participação em decisões e comunicação organizacional.',                                          'Organização',      8),
  ('F09', 'Gestão de carga de trabalho',     'Equilíbrio entre demandas e recursos disponíveis, incluindo suporte.',                            'Organização',      9),
  ('F10', 'Relações interpessoais',          'Qualidade das relações com colegas, gestores e clientes.',                                        'Relações',         10),
  ('F11', 'Sentido do trabalho',             'Percepção de propósito, significado e impacto das atividades realizadas.',                        'Desenvolvimento',  11),
  ('F12', 'Confiança e justiça',             'Transparência, equidade e justiça nas práticas organizacionais.',                                 'Organização',      12),
  ('F13', 'Trabalho-família / vida pessoal', 'Equilíbrio entre as exigências do trabalho e a vida pessoal e familiar. (avaliado via PGR)',      'Relações',         13)
ON CONFLICT (codigo) DO NOTHING;
