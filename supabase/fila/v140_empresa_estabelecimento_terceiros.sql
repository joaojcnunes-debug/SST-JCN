-- ============================================================
-- v140 — Estabelecimento de terceiros no cadastro de empresas
-- ============================================================
-- Um canteiro, obra ou cliente externo passa a ser cadastrado como uma
-- EMPRESA normal, marcada como estabelecimento de terceiros e vinculada à
-- contratante. Com isso a inspeção não precisa saber nada de novo: ela já
-- escolhe uma empresa, e agora essa empresa pode ser um terceiro.
--
-- Por que não uma tabela nova: `empresas` já tem cnpj, cpf, cei, caepf, cno,
-- razao_social, grau_risco, endereço completo, cnae e porte — os mesmos
-- campos que um estabelecimento precisa. Uma tabela paralela seria uma
-- segunda cópia do mesmo cadastro (foi o erro da v139, revista).
--
-- Aditiva e idempotente: as 474 empresas existentes viram 'CLIENTE' e nada
-- no fluxo atual muda.
-- ============================================================

BEGIN;

-- 1) Que tipo de cadastro é este -----------------------------------------------
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS tipo_estabelecimento TEXT NOT NULL DEFAULT 'CLIENTE';

COMMENT ON COLUMN public.empresas.tipo_estabelecimento
  IS 'CLIENTE = empresa contratante dos servicos; TERCEIROS = canteiro/obra/cliente externo onde se trabalha.';

DO $$
BEGIN
  ALTER TABLE public.empresas
    ADD CONSTRAINT empresas_tipo_estab_chk
    CHECK (tipo_estabelecimento IN ('CLIENTE', 'TERCEIROS'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) De quem é este estabelecimento --------------------------------------------
-- ON DELETE SET NULL, e não CASCADE: apagar a contratante não pode levar junto
-- o histórico do canteiro, que tem inspeções e laudos pendurados nele.
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS id_empresa_contratante TEXT
    REFERENCES public.empresas(id_empresa) ON DELETE SET NULL;

COMMENT ON COLUMN public.empresas.id_empresa_contratante
  IS 'Empresa contratante a que este estabelecimento de terceiros pertence. Sempre NULL quando tipo_estabelecimento = CLIENTE.';

-- Uma empresa cliente nunca tem contratante. O caso inverso (terceiro sem
-- contratante) NAO e travado aqui de proposito: a tela exige, mas uma carga
-- antiga ou uma importacao nao pode explodir por causa disso.
DO $$
BEGIN
  ALTER TABLE public.empresas
    ADD CONSTRAINT empresas_contratante_so_em_terceiros_chk
    CHECK (tipo_estabelecimento = 'TERCEIROS' OR id_empresa_contratante IS NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ninguém é contratante de si mesmo — evita o ciclo mais bobo.
DO $$
BEGIN
  ALTER TABLE public.empresas
    ADD CONSTRAINT empresas_contratante_nao_e_ela_mesma_chk
    CHECK (id_empresa_contratante IS DISTINCT FROM id_empresa);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_empresas_contratante
  ON public.empresas (id_empresa_contratante)
  WHERE id_empresa_contratante IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_empresas_tipo_estab
  ON public.empresas (tipo_estabelecimento)
  WHERE tipo_estabelecimento = 'TERCEIROS';

-- 3) Os campos que o cadastro ainda não tinha ----------------------------------
-- Servem para os dois tipos: uma empresa cliente também tem nome fantasia e
-- também precisa registrar onde é o pronto-socorro mais próximo.
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS nome_fantasia     TEXT,
  ADD COLUMN IF NOT EXISTS referencia        TEXT,
  ADD COLUMN IF NOT EXISTS locais_emergencia TEXT,
  ADD COLUMN IF NOT EXISTS dados_adicionais  TEXT;

COMMENT ON COLUMN public.empresas.referencia
  IS 'Ponto de referencia para chegar ao local. Em canteiro sem numero e o que serve de endereco.';
COMMENT ON COLUMN public.empresas.locais_emergencia
  IS 'Hospital, UPA ou ambulatorio mais proximo e telefones.';

-- 4) Trava de sanidade ---------------------------------------------------------
-- Aborta a transação se algo saiu diferente do esperado, em vez de deixar o
-- banco num meio-termo (a v135 quebrou assim em 2026-07-14 e foi o rollback
-- da transação que salvou).
DO $$
DECLARE
  n_clientes INT;
BEGIN
  SELECT count(*) INTO n_clientes
    FROM public.empresas WHERE tipo_estabelecimento = 'CLIENTE';
  IF n_clientes <> (SELECT count(*) FROM public.empresas) THEN
    RAISE EXCEPTION 'v140: nem todas as empresas ficaram como CLIENTE (% de %)',
      n_clientes, (SELECT count(*) FROM public.empresas);
  END IF;
END $$;

COMMIT;
