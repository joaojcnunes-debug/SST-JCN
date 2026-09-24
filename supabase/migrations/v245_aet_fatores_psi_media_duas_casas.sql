-- v245 — AET: `aet_laudo_fatores_psi.media` passa de numeric(3,1) a numeric(4,2)
--
-- PROBLEMA
--   O app calcula a média do fator com DUAS casas (lib/aet/consolidar-psi.ts,
--   `mediaFator` arredonda ×100/100) e manda 4.25. A coluna em produção é
--   **numeric(3,1)** — o banco arredonda em silêncio e guarda **4.3**.
--
--   ⚠️ A v55 deste mesmo repositório declara `media numeric(4,2)`. Ela MENTE:
--   a tabela foi criada fora do versionamento. O cabeçalho da v135 já
--   registrava a divergência. Medido em 22/09/2026 na produção:
--
--       406 linhas · 378 com média · **todas com 1 casa decimal** · 7 laudos
--       min 1.7 · max 5.0 · soma 1671.9
--
--   A coluna segue VIVA: 113 linhas escritas em setembro/2026.
--
-- POR QUE ALARGAR E NÃO CONGELAR
--   Congelar exigiria mexer no app (parar de gravar em duas telas + hook +
--   tipo) e não corrigiria valor nenhum. Alargar é UMA linha de DDL, sem
--   alteração de código: o app já manda 2 casas hoje, é o banco que corta.
--
-- O QUE ESTA MIGRATION **NÃO** FAZ
--   Não reescreve as 378 médias já arredondadas, e isso é de propósito:
--   • 363 delas nunca são lidas — as quatro telas que imprimem o fator
--     recalculam das respostas (`recalcularDasRespostas`);
--   • as 15 restantes são lidas justamente porque **não têm resposta nenhuma**
--     atrás — não há de onde recalcular. Inventar número ali seria pior.
--   Além disso o conjunto de perguntas em vigor vive em TypeScript
--   (`lib/aet/perguntas-default.ts`; `aet_13fatores_perguntas` tem **0 linhas**)
--   e a conta inverte a nota quando `logica = 'direta'` (6 − nota). SQL não
--   reproduz isso com fidelidade. Backfill aqui seria chute com cara de dado.
--
-- ENSAIADO NA PRÓPRIA PRODUÇÃO (22/09, BEGIN…ROLLBACK, nada commitado)
--   • precisão/escala 3,1 → 4,2 e volta no rollback;
--   • soma das médias **1671.9 → 1671.90**: nenhum número mudou, só a escala;
--   • `auditoria_eventos` desta tabela **40 → 40**: rewrite de DDL não dispara
--     o `trg_auditoria` (gatilho de LINHA), então não há enxurrada de log;
--   • dependências de `media`: **nenhuma** — 0 view, 0 índice, 0 constraint
--     (só PK(id), a UNIQUE da v135 e o CHECK de `zona`).
--
-- ROLLBACK: scripts/sql/v245_rollback_aet_fatores_psi_media_duas_casas.sql
BEGIN;

-- Trava: se alguém já alargou à mão, sair sem tocar em nada.
DO $$
DECLARE
  escala int;
BEGIN
  SELECT numeric_scale INTO escala
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'aet_laudo_fatores_psi'
     AND column_name  = 'media';

  IF escala IS NULL THEN
    RAISE EXCEPTION 'v245: coluna aet_laudo_fatores_psi.media nao encontrada.';
  END IF;

  IF escala >= 2 THEN
    RAISE NOTICE 'v245: media ja tem escala % (>= 2). Nada a fazer.', escala;
  END IF;
END $$;

ALTER TABLE public.aet_laudo_fatores_psi
  ALTER COLUMN media TYPE numeric(4,2);

COMMENT ON COLUMN public.aet_laudo_fatores_psi.media IS
  'Média do fator no setor, 0–5 com DUAS casas (v245; era numeric(3,1) e arredondava 4.25 para 4.3). '
  'É um RETRATO do momento do "Salvar Fxx", não a fonte da verdade: as telas e o PDF recalculam das '
  'respostas em aet_laudo_qps_respostas (lib/aet/consolidar-psi.ts). O valor gravado só é impresso '
  'quando o par (setor, fator) nao tem resposta nenhuma, e em F13, que nao tem media.';

-- ── Conferência dentro da própria transação ─────────────────────────────────
DO $$
DECLARE
  escala int;
  n_1casa int;
BEGIN
  SELECT numeric_scale INTO escala
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='aet_laudo_fatores_psi' AND column_name='media';

  IF escala <> 2 THEN
    RAISE EXCEPTION 'v245: escala esperada 2, encontrada %.', escala;
  END IF;

  -- Depois do rewrite nenhuma linha pode continuar com escala 1.
  SELECT count(*) INTO n_1casa
    FROM public.aet_laudo_fatores_psi
   WHERE media IS NOT NULL AND scale(media) <> 2;

  IF n_1casa > 0 THEN
    RAISE EXCEPTION 'v245: % linha(s) nao assumiram 2 casas.', n_1casa;
  END IF;
END $$;


COMMIT;

-- ── Depois do COMMIT ────────────────────────────────────────────────────────
-- O PostgREST guarda o schema em cache; avise-o:
--   NOTIFY pgrst, 'reload schema';
--
-- Conferência:
--   SELECT numeric_precision, numeric_scale FROM information_schema.columns
--    WHERE table_name='aet_laudo_fatores_psi' AND column_name='media';   -- 4 | 2
--   SELECT sum(media), count(*) FROM public.aet_laudo_fatores_psi;       -- 1671.90 | 406
