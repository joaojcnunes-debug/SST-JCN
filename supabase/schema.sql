-- ============================================================
-- Painel SST Chabra — Schema completo
-- Execute este SQL no SQL Editor do Supabase para criar tabelas
-- e bucket de storage. Idempotente (CREATE TABLE IF NOT EXISTS).
-- ============================================================

-- empresas
CREATE TABLE IF NOT EXISTS public.empresas (
    id_empresa TEXT PRIMARY KEY,
    nome_empresa TEXT NOT NULL,
    razao_social TEXT,
    cnpj TEXT,
    cpf TEXT,
    cei TEXT,
    caepf TEXT,
    cno TEXT,
    grau_risco INTEGER,
    status TEXT DEFAULT 'Ativo',
    observacao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- inspecoes
CREATE TABLE IF NOT EXISTS public.inspecoes (
    id_inspecao TEXT PRIMARY KEY,
    id_empresa TEXT REFERENCES public.empresas(id_empresa) ON DELETE CASCADE,
    data_inspecao DATE,
    status TEXT DEFAULT 'RASCUNHO',
    revisao INTEGER DEFAULT 1,
    responsavel TEXT,
    observacoes TEXT,
    tipo_criacao TEXT,
    id_inspecao_base TEXT,
    usuario TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inspecoes_empresa ON public.inspecoes(id_empresa);
CREATE INDEX IF NOT EXISTS idx_inspecoes_status ON public.inspecoes(status);

-- setores
CREATE TABLE IF NOT EXISTS public.setores (
    id_setor TEXT PRIMARY KEY,
    id_inspecao TEXT REFERENCES public.inspecoes(id_inspecao) ON DELETE CASCADE,
    id_empresa TEXT,
    setor_ghe TEXT NOT NULL,
    descricao TEXT,
    conformidade TEXT,
    nao_conformidade TEXT
);

CREATE INDEX IF NOT EXISTS idx_setores_inspecao ON public.setores(id_inspecao);

-- cargos
CREATE TABLE IF NOT EXISTS public.cargos (
    id_cargo TEXT PRIMARY KEY,
    id_inspecao TEXT REFERENCES public.inspecoes(id_inspecao) ON DELETE CASCADE,
    id_empresa TEXT,
    id_setor TEXT REFERENCES public.setores(id_setor) ON DELETE CASCADE,
    cargo TEXT NOT NULL,
    descricao TEXT
);

CREATE INDEX IF NOT EXISTS idx_cargos_inspecao ON public.cargos(id_inspecao);
CREATE INDEX IF NOT EXISTS idx_cargos_setor ON public.cargos(id_setor);

-- riscos
CREATE TABLE IF NOT EXISTS public.riscos (
    id_risco TEXT PRIMARY KEY,
    id_inspecao TEXT REFERENCES public.inspecoes(id_inspecao) ON DELETE CASCADE,
    id_empresa TEXT,
    id_setor TEXT,
    id_cargo TEXT,
    tipo_risco TEXT,
    agente TEXT,
    fonte_geradora TEXT,
    probabilidade TEXT,
    severidade TEXT,
    nivel_risco TEXT,
    medio_propagacao TEXT,
    situacao TEXT,
    tempo_exposicao TEXT,
    tecnica_utilizada TEXT,
    concentracao_exposicao TEXT,
    limite_tolerancia TEXT,
    insalubridade TEXT,
    periculosidade TEXT,
    numero_cas TEXT,
    via_absorcao TEXT,
    tipo_agente_biologico TEXT,
    fator_ergonomico TEXT,
    fator_psicossocial TEXT,
    pontuacao_iapat TEXT,
    medidas_adotadas TEXT,
    medidas_recomendadas TEXT,
    observacoes_risco TEXT
);

CREATE INDEX IF NOT EXISTS idx_riscos_inspecao ON public.riscos(id_inspecao);
CREATE INDEX IF NOT EXISTS idx_riscos_tipo ON public.riscos(tipo_risco);

-- epi_epc
CREATE TABLE IF NOT EXISTS public.epi_epc (
    id_protecao TEXT PRIMARY KEY,
    id_risco TEXT REFERENCES public.riscos(id_risco) ON DELETE CASCADE,
    id_inspecao TEXT,
    id_empresa TEXT,
    id_setor TEXT,
    tipo TEXT,
    descricao TEXT NOT NULL,
    ca TEXT,
    recomendado TEXT
);

CREATE INDEX IF NOT EXISTS idx_epi_inspecao ON public.epi_epc(id_inspecao);
CREATE INDEX IF NOT EXISTS idx_epi_risco ON public.epi_epc(id_risco);

-- fotos
CREATE TABLE IF NOT EXISTS public.fotos (
    id_foto TEXT PRIMARY KEY,
    id_inspecao TEXT REFERENCES public.inspecoes(id_inspecao) ON DELETE CASCADE,
    id_empresa TEXT,
    id_setor TEXT,
    categoria TEXT,
    legenda TEXT,
    arquivo_foto TEXT,
    storage_path TEXT,
    data_upload TIMESTAMPTZ DEFAULT NOW(),
    usuario TEXT
);

CREATE INDEX IF NOT EXISTS idx_fotos_inspecao ON public.fotos(id_inspecao);

-- responsaveis
CREATE TABLE IF NOT EXISTS public.responsaveis (
    id_responsavel TEXT PRIMARY KEY,
    id_inspecao TEXT REFERENCES public.inspecoes(id_inspecao) ON DELETE CASCADE,
    id_empresa TEXT,
    tecnico_responsavel TEXT,
    recepcionado_por TEXT,
    cargo TEXT,
    data_hora TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_responsaveis_inspecao ON public.responsaveis(id_inspecao);

-- usuarios
CREATE TABLE IF NOT EXISTS public.usuarios (
    id_usuario TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    cargo TEXT,
    perfil TEXT DEFAULT 'Tecnico',
    ativo_sistema BOOLEAN DEFAULT TRUE,
    empresas_vinculadas TEXT[] DEFAULT '{}'::TEXT[]
);

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON public.usuarios(email);

-- ============================================================
-- ROW LEVEL SECURITY
-- Habilita RLS e permite leitura/escrita para usuários autenticados.
-- (Refine as policies conforme sua estratégia de segurança.)
-- ============================================================

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspecoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riscos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epi_epc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fotos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responsaveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- Postgres não suporta `CREATE POLICY IF NOT EXISTS`; usamos
-- `DROP POLICY IF EXISTS` antes de cada CREATE POLICY pra manter idempotência.
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'empresas','inspecoes','setores','cargos','riscos',
    'epi_epc','fotos','responsaveis','usuarios'
  ])
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "auth read %1$s" ON public.%1$s;',
      t
    );
    EXECUTE format(
      'CREATE POLICY "auth read %1$s" ON public.%1$s FOR SELECT TO authenticated USING (true);',
      t
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS "auth write %1$s" ON public.%1$s;',
      t
    );
    EXECUTE format(
      'CREATE POLICY "auth write %1$s" ON public.%1$s FOR ALL TO authenticated USING (true) WITH CHECK (true);',
      t
    );
  END LOOP;
END $$;

-- ============================================================
-- STORAGE BUCKET para fotos
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos', 'fotos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read fotos" ON storage.objects;
CREATE POLICY "Public read fotos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'fotos');

DROP POLICY IF EXISTS "Auth upload fotos" ON storage.objects;
CREATE POLICY "Auth upload fotos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'fotos');

DROP POLICY IF EXISTS "Auth update fotos" ON storage.objects;
CREATE POLICY "Auth update fotos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'fotos');

DROP POLICY IF EXISTS "Auth delete fotos" ON storage.objects;
CREATE POLICY "Auth delete fotos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'fotos');

-- ============================================================
-- USUÁRIO ADMIN INICIAL (opcional)
-- 1. Crie em Authentication → Users (signup com email/senha)
-- 2. Rode o INSERT abaixo trocando os campos pelo usuário criado:
-- ============================================================

-- INSERT INTO public.usuarios (id_usuario, nome, email, perfil, ativo_sistema)
-- VALUES (
--   'USR_INITIAL_ADMIN',
--   'Administrador',
--   'admin@chabra.com.br',
--   'Admin',
--   true
-- ) ON CONFLICT (email) DO NOTHING;
