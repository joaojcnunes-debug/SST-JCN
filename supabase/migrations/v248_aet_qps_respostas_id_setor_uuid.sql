-- v248 — AET: `aet_laudo_qps_respostas.id_setor` passa de text a uuid
--
-- PROBLEMA
--   As três tabelas do AET que guardam setor não concordavam no tipo:
--
--       aet_acoes.id_setor               uuid
--       aet_laudo_fatores_psi.id_setor   uuid
--       aet_laudo_qps_respostas.id_setor text   <-- a destoante
--
--   As três guardam a MESMA coisa: o `id` de um objeto dentro do JSONB
--   `aet_relatorios.setores`. Nenhuma tem FK, porque setor não é tabela.
--
--   Consequência imediata: todo SQL que junta respostas com fatores precisa de
--   `f.id_setor::text = r.id_setor`. Sem o cast:
--   `ERROR: operator does not exist: text = uuid`.
--
--   Consequência que importa mais: `text` aceita o que `uuid` recusa —
--   maiúscula, espaço, id truncado. No dia em que algo gravar um id
--   não-canônico, o join erra EM SILÊNCIO, as respostas somem da conta,
--   `mediaFatorDeLinhas` devolve null e o fator inteiro vira "—" no laudo
--   (o caminho que a v0.3.645 acabou de tratar do outro lado).
--
-- POR QUE AGORA, E POR QUE É SEGURO
--   Medido na produção em 22/09/2026, ANTES de escrever esta migration:
--
--     1.475 linhas · 33 ids distintos
--     0 fora do formato canônico · 0 com maiúscula · 0 com espaço
--     0 nulas · 0 vazias
--     SELECT id_setor::uuid FROM … → 1.475 linhas castaram OK
--     29 setores no JSONB, 29 distintos, 0 fora do canônico
--
--   O app gera esses ids com `crypto.randomUUID()` (setores/page.tsx:396), que
--   só produz canônico minúsculo. A base está limpa: a conversão é hoje uma
--   troca de rótulo, não uma correção de dado. É exatamente a janela para
--   fazê-la.
--
--   Dependências conferidas (nada barra o ALTER):
--   • RLS: as 3 políticas da tabela filtram por `id_relatorio` →
--     `aet_relatorios.id_empresa`. **Nenhuma menciona id_setor.**
--   • Views: 0.
--   • Índices: a PK `(id_relatorio, id_setor, codigo_fator, pergunta_ordem)`
--     é reconstruída pelo próprio ALTER. 480 kB — instantâneo.
--   • Gatilho `trg_auditoria` é de LINHA: rewrite de DDL não dispara (provado
--     na v245, `auditoria_eventos` 40 → 40).
--   • O upsert do app usa `onConflict` igual à PK real (useAet.ts:1042) e manda
--     string; o PostgREST converte na entrada.
--
-- EFEITO COLATERAL BOM: a partir daqui, gravar um id_setor que não seja uuid
-- devolve erro na hora em vez de entrar na tabela e sumir do join depois.
--
-- ROLLBACK: scripts/sql/v248_rollback_aet_qps_respostas_id_setor_uuid.sql
BEGIN;

DO $$
DECLARE
  tipo_atual text;
  n_ruins    bigint;
BEGIN
  SELECT data_type INTO tipo_atual
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='aet_laudo_qps_respostas'
     AND column_name='id_setor';

  IF tipo_atual IS NULL THEN
    RAISE EXCEPTION 'v248: coluna aet_laudo_qps_respostas.id_setor nao encontrada.';
  END IF;

  IF tipo_atual = 'uuid' THEN
    RAISE NOTICE 'v248: id_setor ja e uuid. Nada a fazer.';
    RETURN;
  END IF;

  -- O cast sozinho já abortaria, mas com mensagem obscura. Esta fala a língua
  -- de quem vai ler o erro às 7 da manhã.
  SELECT count(*) INTO n_ruins
    FROM public.aet_laudo_qps_respostas
   WHERE id_setor IS NULL
      OR id_setor !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

  IF n_ruins > 0 THEN
    RAISE EXCEPTION
      'ABORTADO: % linha(s) de aet_laudo_qps_respostas tem id_setor que nao e uuid. Converter perderia ou recusaria essas linhas. NADA FOI ALTERADO. Liste-as antes: SELECT DISTINCT id_setor FROM aet_laudo_qps_respostas WHERE id_setor !~ ''^[0-9a-fA-F]{8}-...'';',
      n_ruins;
  END IF;
END $$;

-- Guarda o retrato de ANTES para conferir depois, dentro da mesma transação.
--
-- ⚠️ As DUAS pontas viram ::text de propósito. O óbvio seria `f.id_setor::text
--    = r.id_setor`, que é como se escreve a consulta hoje — mas aí rodar esta
--    migration uma segunda vez estoura com `operator does not exist: uuid =
--    text`, porque r.id_setor já é uuid. (Aconteceu no ensaio: a trava no topo
--    dá RETURN só do bloco DO, não do script.) Comparar texto com texto vale
--    nos dois mundos.
CREATE TEMP TABLE v248_antes ON COMMIT DROP AS
SELECT
  (SELECT count(*) FROM public.aet_laudo_qps_respostas) AS linhas,
  (SELECT count(DISTINCT id_setor) FROM public.aet_laudo_qps_respostas) AS ids,
  (SELECT count(*)
     FROM public.aet_laudo_fatores_psi f
     JOIN public.aet_laudo_qps_respostas r
       ON r.id_relatorio = f.id_relatorio
      AND r.id_setor::text = f.id_setor::text
      AND r.codigo_fator = f.codigo_fator) AS pares;

ALTER TABLE public.aet_laudo_qps_respostas
  ALTER COLUMN id_setor TYPE uuid USING id_setor::uuid;

COMMENT ON COLUMN public.aet_laudo_qps_respostas.id_setor IS
  'Setor do laudo (id do objeto dentro do JSONB aet_relatorios.setores). Sem FK: setor nao e tabela. '
  'uuid desde a v248 — era text, e o join com aet_laudo_fatores_psi exigia cast. Setor excluido deixa '
  'a linha orfa; quem le filtra por apenasSetoresExistentes (lib/aet/consolidar-psi.ts).';

-- ── Conferência dentro da própria transação ─────────────────────────────────
DO $$
DECLARE
  tipo_novo text;
  a         record;
  linhas_d  bigint;
  ids_d     bigint;
  pares_d   bigint;
  tem_pk    boolean;
BEGIN
  SELECT data_type INTO tipo_novo
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='aet_laudo_qps_respostas' AND column_name='id_setor';
  IF tipo_novo <> 'uuid' THEN
    RAISE EXCEPTION 'v248: esperava uuid, encontrei %.', tipo_novo;
  END IF;

  SELECT * INTO a FROM v248_antes;

  SELECT count(*)              INTO linhas_d FROM public.aet_laudo_qps_respostas;
  SELECT count(DISTINCT id_setor) INTO ids_d FROM public.aet_laudo_qps_respostas;
  -- Agora SEM cast: é o ponto da migration.
  SELECT count(*) INTO pares_d
    FROM public.aet_laudo_fatores_psi f
    JOIN public.aet_laudo_qps_respostas r
      ON r.id_relatorio = f.id_relatorio
     AND r.id_setor     = f.id_setor
     AND r.codigo_fator = f.codigo_fator;

  IF linhas_d <> a.linhas THEN
    RAISE EXCEPTION 'v248: linhas mudaram de % para %.', a.linhas, linhas_d;
  END IF;
  IF ids_d <> a.ids THEN
    RAISE EXCEPTION 'v248: ids distintos mudaram de % para % (normalizacao juntou ids?).', a.ids, ids_d;
  END IF;
  IF pares_d <> a.pares THEN
    RAISE EXCEPTION 'v248: o join com fatores_psi casava % pares e passou a casar %.', a.pares, pares_d;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid='public.aet_laudo_qps_respostas'::regclass AND contype='p'
  ) INTO tem_pk;
  IF NOT tem_pk THEN
    RAISE EXCEPTION 'v248: a PRIMARY KEY sumiu no rewrite.';
  END IF;

  RAISE NOTICE 'v248 OK: % linhas, % ids, % pares no join SEM cast, PK intacta.',
    linhas_d, ids_d, pares_d;
END $$;


COMMIT;

-- ── Depois do COMMIT ────────────────────────────────────────────────────────
--   NOTIFY pgrst, 'reload schema';
--
-- Conferência:
--   SELECT data_type FROM information_schema.columns
--    WHERE table_name='aet_laudo_qps_respostas' AND column_name='id_setor';   -- uuid
--   -- e o join que antes exigia cast:
--   SELECT count(*) FROM aet_laudo_fatores_psi f
--     JOIN aet_laudo_qps_respostas r USING (id_relatorio, id_setor, codigo_fator);  -- 1428
