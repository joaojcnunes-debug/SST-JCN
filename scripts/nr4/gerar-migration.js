// Gera a migration a partir do JSON ja conferido. Nenhum valor e digitado a
// mao — a fonte e sempre a saida do conferir-anexo1.js.
//
// Uso: node gerar-migration.js <anexo1.json> <saida.sql>
const fs = require("fs");

const [, , ENTRADA, SAIDA] = process.argv;
if (!ENTRADA || !SAIDA) {
  console.error("uso: node gerar-migration.js <anexo1.json> <saida.sql>");
  process.exit(2);
}
const dados = JSON.parse(fs.readFileSync(ENTRADA, "utf8"));

if (dados.length !== 673) {
  console.error("ERRO: esperava 673 linhas, achei " + dados.length);
  process.exit(1);
}
for (const d of dados) {
  if (!/^\d{5}$/.test(d.cnae_classe) || ![1, 2, 3, 4].includes(d.grau_risco)) {
    console.error("ERRO: linha invalida " + JSON.stringify(d));
    process.exit(1);
  }
}

const esc = (s) => s.replace(/'/g, "''");
const valores = dados
  .map((d) => `  ('${d.cnae_classe}', ${d.grau_risco}, '${esc(d.denominacao)}')`)
  .join(",\n");

const sql = `-- ============================================================
-- v141 — Grau de risco automatico a partir do CNAE (NR-4, Anexo I)
-- ============================================================
-- O grau de risco nao e opiniao: e consulta em tabela. O Anexo I da NR-4
-- da, para cada classe CNAE, o grau de 1 a 4. Como a busca por CNPJ ja
-- traz o CNAE da Receita, o grau pode ser derivado sem digitacao.
--
-- FONTE (unica autorizada, indicada pelo usuario em 22/07/2026):
--   NR-4 atualizada 2023, Anexo I — "RELACAO DA CLASSIFICACAO NACIONAL DE
--   ATIVIDADES ECONOMICAS - CNAE (VERSAO 2.0), COM CORRESPONDENTE GRAU DE
--   RISCO - GR"
--   https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-04-atualizada-2023.pdf
--
-- COMO ESTES DADOS FORAM OBTIDOS: extraidos do PDF por dois metodos
-- independentes (pdftotext -layout e pdftotext -raw, com leitores
-- diferentes), que concordaram nos 673 mapeamentos. O total bate com as
-- 673 classes da CNAE 2.0. Nenhum valor foi digitado a mao.
--
-- GRANULARIDADE: a norma trabalha na CLASSE (5 digitos, ex. 45.11-1). A
-- Receita devolve a SUBCLASSE (7 digitos, ex. 4511102). A subclasse e a
-- classe + 2 digitos, entao truncar em 5 da a classe. E o que a funcao
-- abaixo faz.
--
-- IMPORTANTE: esta tabela NAO altera nenhum cadastro existente. Ela so
-- responde "o que a norma diz". Quem grava e a tela, com uma pessoa
-- decidindo.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.cnae_grau_risco (
  cnae_classe  TEXT PRIMARY KEY,
  grau_risco   INT  NOT NULL,
  denominacao  TEXT NOT NULL,
  -- Versionado: quando a NR-4 mudar, entra outra carga e da para saber de
  -- qual texto veio cada linha.
  versao_norma TEXT NOT NULL DEFAULT 'NR-4 (2023) Anexo I / CNAE 2.0',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE public.cnae_grau_risco
    ADD CONSTRAINT cnae_grau_risco_grau_chk CHECK (grau_risco BETWEEN 1 AND 4);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.cnae_grau_risco
    ADD CONSTRAINT cnae_grau_risco_classe_chk CHECK (cnae_classe ~ '^[0-9]{5}$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE public.cnae_grau_risco
  IS 'Anexo I da NR-4 (2023): classe CNAE 2.0 -> grau de risco. Somente leitura pela aplicacao.';

-- Carga idempotente: reaplicar atualiza em vez de duplicar.
INSERT INTO public.cnae_grau_risco (cnae_classe, grau_risco, denominacao) VALUES
${valores}
ON CONFLICT (cnae_classe) DO UPDATE
  SET grau_risco  = EXCLUDED.grau_risco,
      denominacao = EXCLUDED.denominacao;

-- Trava: a carga tem que ter as 673 classes da CNAE 2.0.
DO $$
DECLARE n INT;
BEGIN
  SELECT count(*) INTO n FROM public.cnae_grau_risco;
  IF n <> 673 THEN
    RAISE EXCEPTION 'v141: esperava 673 classes na tabela, encontrei %', n;
  END IF;
END $$;

-- Procedencia do grau em cada empresa -----------------------------------------
-- NULL nos cadastros antigos: nao da para saber como foram preenchidos, e
-- inventar procedencia seria pior que admitir que nao se sabe.
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS grau_risco_origem TEXT,
  ADD COLUMN IF NOT EXISTS grau_risco_norma  INT;

COMMENT ON COLUMN public.empresas.grau_risco_origem
  IS 'NORMA = veio do Anexo I da NR-4 pelo CNAE; MANUAL = pessoa escolheu outro valor. NULL = cadastro anterior a v141.';
COMMENT ON COLUMN public.empresas.grau_risco_norma
  IS 'O que a NR-4 indicava no momento da gravacao. Permite auditar divergencia mesmo se a norma mudar depois.';

DO $$
BEGIN
  ALTER TABLE public.empresas
    ADD CONSTRAINT empresas_grau_origem_chk
    CHECK (grau_risco_origem IS NULL OR grau_risco_origem IN ('NORMA', 'MANUAL'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Funcao de consulta: recebe o CNAE em qualquer formato (subclasse com ou
-- sem mascara, classe com ou sem mascara) e devolve o grau da norma.
CREATE OR REPLACE FUNCTION public.grau_risco_por_cnae(p_cnae TEXT)
RETURNS INT
LANGUAGE sql STABLE AS $$
  SELECT g.grau_risco
    FROM public.cnae_grau_risco g
   WHERE g.cnae_classe = substr(regexp_replace(coalesce(p_cnae, ''), '[^0-9]', '', 'g'), 1, 5)
$$;

COMMENT ON FUNCTION public.grau_risco_por_cnae(TEXT)
  IS 'Grau de risco da NR-4 para um CNAE (subclasse ou classe, com ou sem mascara). NULL se o CNAE nao existir no Anexo I.';

-- RLS: leitura para qualquer usuario autenticado; ninguem escreve pela app.
-- A tabela so muda por migration, quando a norma mudar.
ALTER TABLE public.cnae_grau_risco ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read cnae_grau_risco" ON public.cnae_grau_risco;
CREATE POLICY "auth read cnae_grau_risco"
  ON public.cnae_grau_risco FOR SELECT TO authenticated USING (true);

COMMIT;
`;

fs.writeFileSync(SAIDA, sql);
console.log("gerado: " + SAIDA);
console.log("linhas de dados: " + dados.length);
console.log("tamanho: " + Math.round(sql.length / 1024) + " KB");
