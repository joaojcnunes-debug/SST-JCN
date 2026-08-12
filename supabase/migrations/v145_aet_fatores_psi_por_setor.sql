-- v145 (SST-JCN, espelha painel v135) — AET: fatores psicossociais passam a ser POR SETOR
--
-- PROBLEMA
--   aet_laudo_fatores_psi só admitia UMA linha por fator para o laudo inteiro.
--   Mas o questionário é respondido por setor (aet_laudo_qps_respostas JÁ tem
--   id_setor). Resultado: observação, pergunta crítica, média e zona eram
--   compartilhadas entre todos os setores. O último setor salvo sobrescrevia os
--   anteriores, e o laudo publicava esse valor para todos — num documento
--   assinado, em silêncio.
--
-- SOLUÇÃO
--   Acrescenta id_setor e passa a unicidade para (id_relatorio, id_setor,
--   codigo_fator).
--
-- ⚠️ SCHEMA REAL ≠ v55. A v55 declarava PK (id_relatorio, codigo_fator), mas a
--    tabela em produção foi criada fora do versionamento e tem outra forma:
--
--      PRIMARY KEY (id)  -- uuid substituto, default gen_random_uuid()
--      UNIQUE CONSTRAINT aet_laudo_fatores_psi_id_relatorio_codigo_fator_key
--                        (id_relatorio, codigo_fator)   <-- a chave de negócio
--      media numeric(3,1)   -- e não numeric(4,2)
--
--    Logo: a PK substituta NÃO é tocada. Quem sai é a UNIQUE — é ela que
--    impedia mais de uma linha por fator. (A 1ª tentativa desta migration
--    falhou exatamente aqui, e o rollback da transação segurou tudo.)
--
-- BACKFILL
--   Cada linha existente é REPLICADA para todos os setores do seu laudo. Assim
--   o conteúdo atual continua aparecendo igual ao de hoje (nada some), e a
--   partir daí cada setor passa a ser editável de forma independente. As linhas
--   novas ganham `id` novo pelo default — por isso o INSERT não copia `id`.
--
-- ROLLBACK
--   A tabela aet_laudo_fatores_psi_bkp guarda o estado exato de antes. Para
--   regredir, ver scripts/sql/v135_rollback_... (fora de migrations/ de
--   propósito, para ninguém rodar por engano).
--
-- NOTA: id_setor NÃO tem FK — os setores vivem no JSONB aet_relatorios.setores,
-- não em tabela própria. A integridade é garantida pelo app.

BEGIN;

-- ── 0. TRAVA DE SEGURANÇA — não rodar duas vezes ─────────────────────────────
-- Estas migrations são aplicadas À MÃO, então reexecutar é um cenário real.
-- Sem esta trava, a 2ª execução passaria batido pelos IF NOT EXISTS, cairia no
-- DELETE do passo 4 e repovoaria a tabela a partir do backup PRÉ-v135 —
-- apagando em silêncio, sem erro nenhum, tudo que os técnicos escreveram por
-- setor desde a 1ª execução. Aqui a transação aborta antes de tocar em nada.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'aet_laudo_fatores_psi' AND column_name = 'id_setor'
  ) THEN
    RAISE EXCEPTION 'v135 JA FOI APLICADA (coluna id_setor existe). Abortando para nao apagar os dados por setor. Se precisa mesmo reverter, use scripts/sql/v135_rollback_aet_fatores_psi_por_setor.sql.';
  END IF;
END $$;

-- ── 0b. GARANTIA DE NÃO-PERDA ───────────────────────────────────────────────
-- O backfill atribui cada fator aos setores do seu laudo. Se algum laudo tiver
-- fatores preenchidos mas NENHUM setor válido no JSONB, essas linhas não teriam
-- a quem pertencer e seriam descartadas.
--
-- Em vez de descartar em silêncio, ABORTA. Como estamos dentro da transação e
-- ainda não escrevemos nada, o banco fica exatamente como estava.
DO $$
DECLARE
  n_sem_setor int;
BEGIN
  SELECT count(*) INTO n_sem_setor
  FROM aet_laudo_fatores_psi f
  WHERE NOT EXISTS (
    SELECT 1
    FROM aet_relatorios r
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.setores, '[]'::jsonb)) AS s
    WHERE r.id_relatorio = f.id_relatorio
      AND s->>'id' IS NOT NULL
      AND (s->>'id') ~ '^[0-9a-fA-F-]{36}$'
  );

  IF n_sem_setor > 0 THEN
    RAISE EXCEPTION
      'ABORTADO: % linha(s) de fatores psi pertencem a laudos sem setor valido. Elas seriam perdidas no backfill. NADA FOI ALTERADO. Investigue esses laudos antes de aplicar a v135.',
      n_sem_setor;
  END IF;
END $$;

-- ── 1. Cópia de segurança (base para regredir) ───────────────────────────────
-- Sem IF NOT EXISTS de propósito: se já houver um backup, algo saiu do script —
-- melhor estourar aqui do que sobrescrever/preservar a cópia errada.
CREATE TABLE aet_laudo_fatores_psi_bkp AS
SELECT * FROM aet_laudo_fatores_psi;

COMMENT ON TABLE aet_laudo_fatores_psi_bkp IS
  'Snapshot de aet_laudo_fatores_psi ANTES da v135 (fatores psi por setor). Base de rollback. Pode ser removida após a validação em produção.';

-- ── 2. Nova coluna ──────────────────────────────────────────────────────────
ALTER TABLE aet_laudo_fatores_psi
  ADD COLUMN IF NOT EXISTS id_setor uuid;

-- ── 3. Solta a UNIQUE antiga ────────────────────────────────────────────────
-- É ela — e não a PK — que limitava a 1 linha por (laudo, fator). A PRIMARY KEY
-- é o `id` substituto e permanece intacta.
ALTER TABLE aet_laudo_fatores_psi
  DROP CONSTRAINT IF EXISTS aet_laudo_fatores_psi_id_relatorio_codigo_fator_key;

-- ── 4. Expande: 1 linha por (laudo, setor, fator) ───────────────────────────
-- Reescreve a tabela a partir da cópia, replicando cada fator para cada setor
-- do laudo. `id` não é copiado de propósito: cada linha nova ganha o seu pelo
-- default gen_random_uuid() (senão a PK substituta colidiria).
DELETE FROM aet_laudo_fatores_psi;

INSERT INTO aet_laudo_fatores_psi
  (id_relatorio, id_setor, codigo_fator, avaliado, media, pct_zona_risco,
   pergunta_critica, observacao, zona, updated_at)
SELECT
  f.id_relatorio,
  (s->>'id')::uuid,
  f.codigo_fator,
  f.avaliado,
  f.media,
  f.pct_zona_risco,
  f.pergunta_critica,
  f.observacao,
  f.zona,
  f.updated_at
FROM aet_laudo_fatores_psi_bkp f
JOIN aet_relatorios r
  ON r.id_relatorio = f.id_relatorio
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.setores, '[]'::jsonb)) AS s
WHERE s->>'id' IS NOT NULL
  AND (s->>'id') ~ '^[0-9a-fA-F-]{36}$';

-- ── 5. Nova chave de negócio ────────────────────────────────────────────────
-- É esta UNIQUE que o upsert do app referencia (onConflict
-- "id_relatorio,id_setor,codigo_fator" em useAetSalvarFatorPsi).
ALTER TABLE aet_laudo_fatores_psi
  ALTER COLUMN id_setor SET NOT NULL;

ALTER TABLE aet_laudo_fatores_psi
  ADD CONSTRAINT aet_laudo_fatores_psi_relatorio_setor_fator_key
  UNIQUE (id_relatorio, id_setor, codigo_fator);

COMMENT ON COLUMN aet_laudo_fatores_psi.id_setor IS
  'Setor do laudo (id do objeto dentro do JSONB aet_relatorios.setores). Sem FK: setor não é tabela.';

COMMIT;

-- ── Conferência (rodar depois do COMMIT) ────────────────────────────────────
--
-- (a) A tabela deve ter CRESCIDO — uma linha por setor de cada laudo:
--
--   SELECT
--     (SELECT count(*) FROM aet_laudo_fatores_psi_bkp) AS linhas_antes,
--     (SELECT count(*) FROM aet_laudo_fatores_psi)     AS linhas_depois;
--
-- (b) Linhas que NÃO foram migradas. São exatamente os fatores de laudos cujo
--     JSONB `setores` está vazio — não há setor a quem atribuí-los. Elas seguem
--     preservadas em _bkp. O esperado é ZERO (não dá para responder o QPS sem
--     ter criado um setor antes). Se vier algo, investigue o laudo ANTES de
--     liberar o uso — não é uma falha da migration, mas é um laudo estranho:
--
--   SELECT b.id_relatorio, count(*) AS fatores_nao_migrados
--   FROM aet_laudo_fatores_psi_bkp b
--   WHERE NOT EXISTS (
--     SELECT 1 FROM aet_laudo_fatores_psi n
--     WHERE n.id_relatorio = b.id_relatorio AND n.codigo_fator = b.codigo_fator
--   )
--   GROUP BY b.id_relatorio;
