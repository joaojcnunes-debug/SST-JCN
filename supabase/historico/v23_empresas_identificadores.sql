-- ============================================================
-- v23 — Identificadores alternativos no cadastro de empresas
-- ============================================================
-- Adiciona CPF / CEI / CAEPF / CNO ao lado do CNPJ. Todos opcionais
-- e armazenados como TEXT (apenas dígitos; a formatação fica na UI).
-- Idempotente: roda novamente sem efeito se as colunas já existirem.
-- ============================================================

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS cei TEXT,
  ADD COLUMN IF NOT EXISTS caepf TEXT,
  ADD COLUMN IF NOT EXISTS cno TEXT;

COMMENT ON COLUMN public.empresas.cpf
  IS 'CPF (11 digitos, sem mascara). Alternativa ao CNPJ para PF.';
COMMENT ON COLUMN public.empresas.cei
  IS 'CEI - Cadastro Especifico do INSS (12 digitos).';
COMMENT ON COLUMN public.empresas.caepf
  IS 'CAEPF - Cadastro de Atividade Economica da PF (14 digitos).';
COMMENT ON COLUMN public.empresas.cno
  IS 'CNO - Cadastro Nacional de Obras (12 digitos).';
