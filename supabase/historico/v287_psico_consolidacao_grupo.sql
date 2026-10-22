-- v287 (JCN) — Consolidação Psicossocial de Grupo (o banco)
-- Replicado do Painel SST (v295, commit ed0d58e7, v0.3.757) + o glossário corrigido da
-- v299 (commit 2dd32f5d), sem a trava de banco do painel e sem schema_migrations.
--
-- POR QUÊ: quando os trabalhadores transitam entre as empresas de um grupo, o risco
-- psicossocial achado num setor de uma empresa tem de constar no mesmo setor de todas.
-- A equipe define; o cliente valida. Reaproveita os grupos da v278/v283.
--
-- O QUE FAZ
--   1) empresas.papel_economico (SPE | EXECUTORA | INCORPORADORA | OUTRA) e
--      empresa_grupos.psico_fatores_ignorados;
--   2) psico_fatores (13, seed) + psico_fator_depara (AEP e DRPS → fator);
--   3) psico_setor_canonico (por grupo, flag transita) + psico_setor_depara;
--   4) psico_consolidacao_execucoes / _itens / _validacoes — APPEND-ONLY (RLS só
--      SELECT e INSERT + gatilho que recusa UPDATE/DELETE);
--   5) psico_glossario (editável só por Admin).
--   Leitura: só a equipe interna (perfil <> 'Cliente'); itens e validações respeitam a
--   unidade (caller_pode_ver_empresa). A auditoria liga sozinha (v255).
--
-- REAPLICAR: idempotente.
-- ROLLBACK: scripts/sql/v287_psico_consolidacao_grupo_rollback.sql


DO $$ BEGIN
  IF to_regprocedure('public.caller_pode_editar()') IS NULL
     OR to_regprocedure('public.caller_eh_admin()') IS NULL
     OR to_regprocedure('public.caller_pode_ver_empresa(text)') IS NULL
     OR to_regclass('public.empresa_grupos') IS NULL THEN
    RAISE EXCEPTION 'faltam caller_pode_editar()/caller_eh_admin()/caller_pode_ver_empresa(text) ou a v282';
  END IF;
END $$;

-- ── 0) Quem é equipe interna (o portal do cliente não enxerga a consolidação) ──
CREATE OR REPLACE FUNCTION public.psico_caller_interno()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios x
     WHERE lower(x.email) = lower(auth.jwt() ->> 'email')
       AND x.ativo_sistema = true
       AND x.perfil IS DISTINCT FROM 'Cliente'
  );
$$;
REVOKE ALL ON FUNCTION public.psico_caller_interno() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.psico_caller_interno() TO authenticated;

-- Gatilho das tabelas append-only.
CREATE OR REPLACE FUNCTION public.psico_somente_insercao()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '%: registro imutável (append-only) — % recusado', TG_TABLE_NAME, TG_OP
    USING ERRCODE = '42501';
END $$;

-- ── 1) Papel no grupo econômico + fatores desligados por grupo ─────────────────
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS papel_economico text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'empresas_papel_economico_chk') THEN
    ALTER TABLE public.empresas ADD CONSTRAINT empresas_papel_economico_chk
      CHECK (papel_economico IS NULL OR papel_economico IN ('SPE', 'EXECUTORA', 'INCORPORADORA', 'OUTRA'));
  END IF;
END $$;
COMMENT ON COLUMN public.empresas.papel_economico IS
  'Papel no grupo econômico (SPE/EXECUTORA/INCORPORADORA/OUTRA), independente de matriz/filial. v287 (painel v295).';

ALTER TABLE public.empresa_grupos
  ADD COLUMN IF NOT EXISTS psico_fatores_ignorados text[] NOT NULL DEFAULT '{}';
COMMENT ON COLUMN public.empresa_grupos.psico_fatores_ignorados IS
  'Fatores psicossociais (psico_fatores.id_fator) fora da consolidação deste grupo. v287 (painel v295).';

-- ── 2) Catálogo de fatores + de-para ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.psico_fatores (
  id_fator   text PRIMARY KEY,                 -- = chave da AEP (lib/aep/checklist-itens.ts)
  nome       text NOT NULL CHECK (btrim(nome) <> ''),
  nome_curto text NOT NULL CHECK (btrim(nome_curto) <> ''),
  ordem      integer NOT NULL,
  ativo      boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.psico_fatores IS
  'Catálogo único de fatores psicossociais da consolidação de grupo (13, seed). v287 (painel v295).';

CREATE TABLE IF NOT EXISTS public.psico_fator_depara (
  origem       text NOT NULL CHECK (origem IN ('AEP', 'DRPS', 'QPS')),
  valor_origem text NOT NULL CHECK (btrim(valor_origem) <> ''),
  id_fator     text NOT NULL REFERENCES public.psico_fatores(id_fator) ON DELETE RESTRICT,
  PRIMARY KEY (origem, valor_origem)
);
COMMENT ON TABLE public.psico_fator_depara IS
  'Nome/chave do fator na origem (AEP chave, DRPS nome do tópico, QPS nome da categoria) → fator canônico. v287 (painel v295).';

INSERT INTO public.psico_fatores (id_fator, nome, nome_curto, ordem) VALUES
  ('assedio',                'Assédio de qualquer natureza',                       'Assédio',                 1),
  ('eventos_traumaticos',    'Eventos violentos ou traumáticos',                   'Eventos violentos',       2),
  ('sobrecarga',             'Excesso de demandas no trabalho (Sobrecarga)',       'Sobrecarga',              3),
  ('recompensas',            'Baixas recompensas e reconhecimento',                'Baixas recompensas',      4),
  ('falta_suporte',          'Falta de suporte / Apoio no trabalho',               'Falta de suporte',        5),
  ('subcarga',               'Baixa demanda no trabalho (Subcarga)',               'Subcarga',                6),
  ('gestao_mudancas',        'Má gestão de mudanças organizacionais',              'Gestão de mudanças',      7),
  ('maus_relacionamentos',   'Maus relacionamentos no local de trabalho',          'Maus relacionamentos',    8),
  ('baixo_controle',         'Baixo controle no trabalho / Falta de autonomia',    'Baixo controle',          9),
  ('clareza_papel',          'Baixa clareza de papel / Função',                    'Baixa clareza',          10),
  ('comunicacao_dificil',    'Trabalho em condições de difícil comunicação',       'Difícil comunicação',    11),
  ('justica_organizacional', 'Baixa justiça organizacional',                       'Baixa justiça',          12),
  ('trabalho_remoto',        'Trabalho remoto e isolado',                          'Trabalho remoto',        13)
ON CONFLICT (id_fator) DO NOTHING;

-- AEP: a chave do checklist organizacional é o próprio id_fator.
INSERT INTO public.psico_fator_depara (origem, valor_origem, id_fator)
SELECT 'AEP', id_fator, id_fator FROM public.psico_fatores
ON CONFLICT (origem, valor_origem) DO NOTHING;

-- DRPS: nome do tópico como está em lib/drps/topicos.ts.
INSERT INTO public.psico_fator_depara (origem, valor_origem, id_fator) VALUES
  ('DRPS', 'Tópico 01 - Assédio de qualquer natureza no trabalho',            'assedio'),
  ('DRPS', 'Tópico 02 - Falta de suporte/apoio no trabalho',                  'falta_suporte'),
  ('DRPS', 'Tópico 03 - Má gestão de mudanças organizacionais',               'gestao_mudancas'),
  ('DRPS', 'Tópico 04 - Baixa clareza de papel/função',                       'clareza_papel'),
  ('DRPS', 'Tópico 05 - Baixas recompensas e reconhecimento',                 'recompensas'),
  ('DRPS', 'Tópico 06 - Baixo controle no trabalho / Falta de autonomia',     'baixo_controle'),
  ('DRPS', 'Tópico 07 - Baixa justiça organizacional',                        'justica_organizacional'),
  ('DRPS', 'Tópico 08 - Eventos violentos ou traumáticos',                    'eventos_traumaticos'),
  ('DRPS', 'Tópico 09 - Baixa demanda no trabalho (Subcarga)',                'subcarga'),
  ('DRPS', 'Tópico 10 - Excesso de demandas no trabalho (Sobrecarga)',        'sobrecarga'),
  ('DRPS', 'Tópico 11 - Maus relacionamentos no local de trabalho',           'maus_relacionamentos'),
  ('DRPS', 'Tópico 12 - Trabalho em condições de difícil comunicação',        'comunicacao_dificil'),
  ('DRPS', 'Tópico 13 - Trabalho remoto e isolado',                           'trabalho_remoto')
ON CONFLICT (origem, valor_origem) DO NOTHING;
-- QPS: as categorias são cadastradas por tipo (qps_categorias); o de-para delas nasce
-- na fase 3, pela tela, com sugestão automática.

-- ── 3) Setores canônicos + de-para ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.psico_setor_canonico (
  id_setor_canonico text PRIMARY KEY,           -- SCN-XXXXXXXX (gerarId no cliente)
  id_grupo          text NOT NULL REFERENCES public.empresa_grupos(id_grupo) ON DELETE CASCADE,
  nome              text NOT NULL CHECK (btrim(nome) <> ''),
  transita          boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        text DEFAULT lower(nullif(auth.jwt() ->> 'email', ''))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_psico_setor_canonico_nome
  ON public.psico_setor_canonico (id_grupo, lower(btrim(nome)));
COMMENT ON TABLE public.psico_setor_canonico IS
  'Setor padronizado por grupo; transita=false tira o setor da harmonização. v287 (painel v295).';

CREATE TABLE IF NOT EXISTS public.psico_setor_depara (
  id_depara         text PRIMARY KEY,           -- SDP-XXXXXXXX
  id_grupo          text NOT NULL REFERENCES public.empresa_grupos(id_grupo) ON DELETE CASCADE,
  id_empresa        text NOT NULL REFERENCES public.empresas(id_empresa) ON DELETE CASCADE,
  origem            text NOT NULL CHECK (origem IN ('AEP', 'DRPS', 'QPS')),
  setor_original    text NOT NULL CHECK (btrim(setor_original) <> ''),
  id_setor_canonico text REFERENCES public.psico_setor_canonico(id_setor_canonico) ON DELETE SET NULL,
  confirmado_por    text,
  confirmado_em     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CHECK ((confirmado_por IS NULL) = (confirmado_em IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_psico_setor_depara
  ON public.psico_setor_depara (id_grupo, id_empresa, origem, setor_original);
COMMENT ON TABLE public.psico_setor_depara IS
  'Nome do setor como está no documento → setor canônico do grupo; o original fica para auditoria. v287 (painel v295).';

-- ── 4) Execuções, itens e validações (append-only) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.psico_consolidacao_execucoes (
  id_execucao text PRIMARY KEY,                 -- PCX-XXXXXXXX
  id_grupo    text NOT NULL REFERENCES public.empresa_grupos(id_grupo) ON DELETE RESTRICT,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  criado_por  text NOT NULL DEFAULT lower(nullif(auth.jwt() ->> 'email', '')),
  fontes      jsonb NOT NULL DEFAULT '[]',      -- documentos lidos (id, tipo, empresa, updated_at)
  parametros  jsonb NOT NULL DEFAULT '{}',      -- incluir_baixo, premissa de trânsito, fatores ignorados
  resultado   jsonb NOT NULL DEFAULT '{}',      -- foto do motor: perfil, lacunas, confronto, totais
  observacao  text
);
CREATE INDEX IF NOT EXISTS ix_psico_execucoes_grupo
  ON public.psico_consolidacao_execucoes (id_grupo, criado_em DESC);
COMMENT ON TABLE public.psico_consolidacao_execucoes IS
  'Rodada da consolidação de um grupo (foto imutável). v287 (painel v295).';

CREATE TABLE IF NOT EXISTS public.psico_consolidacao_itens (
  id_item           text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  id_execucao       text NOT NULL REFERENCES public.psico_consolidacao_execucoes(id_execucao) ON DELETE RESTRICT,
  id_empresa        text NOT NULL,
  origem            text NOT NULL CHECK (origem IN ('AEP', 'DRPS', 'QPS')),
  id_documento      text,
  setor_original    text NOT NULL,
  id_setor_canonico text,
  setor_canonico    text,
  id_fator          text NOT NULL,
  nivel             text NOT NULL CHECK (nivel IN ('Baixo', 'Médio', 'Alto', 'Crítico', 'Identificado')),
  sinais            text[] NOT NULL DEFAULT '{}',
  respondentes      integer
);
CREATE INDEX IF NOT EXISTS ix_psico_itens_execucao
  ON public.psico_consolidacao_itens (id_execucao);
COMMENT ON TABLE public.psico_consolidacao_itens IS
  'Linhas normalizadas (empresa × setor × fator × origem) usadas numa execução. v287 (painel v295).';

CREATE TABLE IF NOT EXISTS public.psico_consolidacao_validacoes (
  id_validacao   text PRIMARY KEY,              -- PCV-XXXXXXXX
  id_execucao    text NOT NULL REFERENCES public.psico_consolidacao_execucoes(id_execucao) ON DELETE RESTRICT,
  id_empresa     text NOT NULL,
  decisao        text NOT NULL CHECK (decisao IN ('VALIDADO', 'COM_RESSALVA')),
  validado_por   text NOT NULL CHECK (btrim(validado_por) <> ''),  -- quem do cliente validou
  comentario     text,
  validado_em    date NOT NULL,
  anexo_path     text,                          -- e-mail/arquivo do cliente no storage
  registrado_por text NOT NULL DEFAULT lower(nullif(auth.jwt() ->> 'email', '')),
  registrado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_psico_validacoes_execucao
  ON public.psico_consolidacao_validacoes (id_execucao);
COMMENT ON TABLE public.psico_consolidacao_validacoes IS
  'Validação do cliente registrada pela JCN (append-only). v287 (painel v295).';

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['psico_consolidacao_execucoes', 'psico_consolidacao_itens', 'psico_consolidacao_validacoes'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_imutavel ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_imutavel BEFORE UPDATE OR DELETE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.psico_somente_insercao()', t, t);
  END LOOP;
END $$;

-- ── 5) Glossário ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.psico_glossario (
  sigla       text PRIMARY KEY CHECK (btrim(sigla) <> ''),
  significado text NOT NULL CHECK (btrim(significado) <> ''),
  explicacao  text,
  ordem       integer NOT NULL DEFAULT 100,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text DEFAULT lower(nullif(auth.jwt() ->> 'email', ''))
);
COMMENT ON TABLE public.psico_glossario IS
  'Siglas explicadas nos relatórios da consolidação (editável por Admin). v287 (painel v295).';

INSERT INTO public.psico_glossario (sigla, significado, explicacao, ordem) VALUES
  ('PGR',   'Programa de Gerenciamento de Riscos (NR-01)',
            'Inventário de riscos por setor. Os riscos psicossociais fazem parte do inventário.', 10),
  ('GRO',   'Gerenciamento de Riscos Ocupacionais (NR-01)',
            'Processo do qual o PGR faz parte.', 20),
  ('PCMSO', 'Programa de Controle Médico de Saúde Ocupacional (NR-07)',
            'Elaborado pelo médico responsável a partir dos riscos do PGR. Esta consolidação não define o PCMSO.', 30),
  ('ASO',   'Atestado de Saúde Ocupacional',
            'Registra os riscos a que o trabalhador está exposto.', 40),
  ('AEP',   'Análise Ergonômica Preliminar',
            'Triagem em campo, por setor: aponta os fatores pelos sinais observados.', 50),
  ('AET',   'Análise Ergonômica do Trabalho (NR-17)',
            'Aprofundamento indicado pela AEP.', 60),
  ('DRPS',  'Diagnóstico de Riscos Psicossociais',
            'Avaliação psicossocial feita a partir das respostas dos trabalhadores ao questionário.', 70),
  ('QPS',   'Questionário Psicossocial',
            'Questionário respondido pelos trabalhadores, por setor, com tipos configuráveis (ex.: QAP). O resultado é convertido em risco pela mesma régua do DRPS.', 80),
  ('QAP',   'Questionário de Avaliação Psicossocial',
            'Tipo de questionário do QPS. O resultado segue a mesma régua do DRPS.', 90),
  ('GHE',   'Grupo Homogêneo de Exposição',
            'Trabalhadores com a mesma exposição a riscos.', 100)
ON CONFLICT (sigla) DO NOTHING;

-- ── 6) RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.psico_fatores                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psico_fator_depara            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psico_setor_canonico          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psico_setor_depara            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psico_consolidacao_execucoes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psico_consolidacao_itens      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psico_consolidacao_validacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psico_glossario               ENABLE ROW LEVEL SECURITY;

-- Catálogos (fatores, de-para de fatores, glossário): todos leem, só Admin escreve.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['psico_fatores', 'psico_fator_depara', 'psico_glossario'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_sel', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', t || '_sel', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_adm', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated
                    USING (public.caller_eh_admin()) WITH CHECK (public.caller_eh_admin())', t || '_adm', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END $$;

-- Setores canônicos: equipe interna lê; quem edita empresa escreve.
DROP POLICY IF EXISTS psico_setor_canonico_sel ON public.psico_setor_canonico;
CREATE POLICY psico_setor_canonico_sel ON public.psico_setor_canonico
  FOR SELECT TO authenticated USING (public.psico_caller_interno());
DROP POLICY IF EXISTS psico_setor_canonico_ins ON public.psico_setor_canonico;
CREATE POLICY psico_setor_canonico_ins ON public.psico_setor_canonico
  FOR INSERT TO authenticated WITH CHECK (public.caller_pode_editar());
DROP POLICY IF EXISTS psico_setor_canonico_upd ON public.psico_setor_canonico;
CREATE POLICY psico_setor_canonico_upd ON public.psico_setor_canonico
  FOR UPDATE TO authenticated USING (public.caller_pode_editar()) WITH CHECK (public.caller_pode_editar());
DROP POLICY IF EXISTS psico_setor_canonico_del ON public.psico_setor_canonico;
CREATE POLICY psico_setor_canonico_del ON public.psico_setor_canonico
  FOR DELETE TO authenticated USING (public.caller_pode_editar());
REVOKE ALL ON public.psico_setor_canonico FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.psico_setor_canonico TO authenticated;

-- De-para de setores: idem, e a empresa precisa ser visível para quem escreve.
DROP POLICY IF EXISTS psico_setor_depara_sel ON public.psico_setor_depara;
CREATE POLICY psico_setor_depara_sel ON public.psico_setor_depara
  FOR SELECT TO authenticated USING (public.psico_caller_interno());
DROP POLICY IF EXISTS psico_setor_depara_ins ON public.psico_setor_depara;
CREATE POLICY psico_setor_depara_ins ON public.psico_setor_depara
  FOR INSERT TO authenticated
  WITH CHECK (public.caller_pode_editar() AND public.caller_pode_ver_empresa(id_empresa));
DROP POLICY IF EXISTS psico_setor_depara_upd ON public.psico_setor_depara;
CREATE POLICY psico_setor_depara_upd ON public.psico_setor_depara
  FOR UPDATE TO authenticated
  USING (public.caller_pode_editar() AND public.caller_pode_ver_empresa(id_empresa))
  WITH CHECK (public.caller_pode_editar() AND public.caller_pode_ver_empresa(id_empresa));
DROP POLICY IF EXISTS psico_setor_depara_del ON public.psico_setor_depara;
CREATE POLICY psico_setor_depara_del ON public.psico_setor_depara
  FOR DELETE TO authenticated
  USING (public.caller_pode_editar() AND public.caller_pode_ver_empresa(id_empresa));
REVOKE ALL ON public.psico_setor_depara FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.psico_setor_depara TO authenticated;

-- Append-only: só SELECT e INSERT.
DROP POLICY IF EXISTS psico_execucoes_sel ON public.psico_consolidacao_execucoes;
CREATE POLICY psico_execucoes_sel ON public.psico_consolidacao_execucoes
  FOR SELECT TO authenticated USING (public.psico_caller_interno());
DROP POLICY IF EXISTS psico_execucoes_ins ON public.psico_consolidacao_execucoes;
CREATE POLICY psico_execucoes_ins ON public.psico_consolidacao_execucoes
  FOR INSERT TO authenticated WITH CHECK (public.caller_pode_editar());

DROP POLICY IF EXISTS psico_itens_sel ON public.psico_consolidacao_itens;
CREATE POLICY psico_itens_sel ON public.psico_consolidacao_itens
  FOR SELECT TO authenticated
  USING (public.psico_caller_interno() AND public.caller_pode_ver_empresa(id_empresa));
DROP POLICY IF EXISTS psico_itens_ins ON public.psico_consolidacao_itens;
CREATE POLICY psico_itens_ins ON public.psico_consolidacao_itens
  FOR INSERT TO authenticated
  WITH CHECK (public.caller_pode_editar() AND public.caller_pode_ver_empresa(id_empresa));

DROP POLICY IF EXISTS psico_validacoes_sel ON public.psico_consolidacao_validacoes;
CREATE POLICY psico_validacoes_sel ON public.psico_consolidacao_validacoes
  FOR SELECT TO authenticated
  USING (public.psico_caller_interno() AND public.caller_pode_ver_empresa(id_empresa));
DROP POLICY IF EXISTS psico_validacoes_ins ON public.psico_consolidacao_validacoes;
CREATE POLICY psico_validacoes_ins ON public.psico_consolidacao_validacoes
  FOR INSERT TO authenticated
  WITH CHECK (public.caller_pode_editar() AND public.caller_pode_ver_empresa(id_empresa));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['psico_consolidacao_execucoes', 'psico_consolidacao_itens', 'psico_consolidacao_validacoes'] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT ON public.%I TO authenticated', t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

