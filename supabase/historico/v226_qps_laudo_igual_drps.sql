-- v226: o LAUDO (PDF) dos Questionários Psicossociais, igual ao do DRPS
-- (decisão do Sanmyo em 17/09/2026) — e a limpeza autorizada por ele no mesmo dia.
--
-- Três coisas, todas pequenas:
--
--   1. `textos_padrao.modulo` aceita 'qps': o laudo é montado como o do DRPS,
--      por capítulos (editáveis + seções do sistema) ordenados. Semeia as
--      seções do sistema do módulo (tipo 'fixo') para o laudo nascer no modo
--      unificado; capa, introdução e metodologia o psicólogo cria na tela
--      Configuração › Texto Padrão › QAP (os textos do DRPS descrevem o DRPS —
--      13 tópicos, 50 perguntas — e por isso NÃO são copiados).
--   2. `qps_aplicacoes` ganha `crp` e `data_elaboracao` — o cabeçalho e a folha
--      de assinatura do laudo imprimem os dois. `data_elaboracao` nasce com a
--      data de criação nas aplicações existentes e CURRENT_DATE nas novas.
--   3. DROP de `qps_planos_acao` (o plano simples que o 5W2H substituiu na
--      v225). Tinha 0 linhas em 17/09; a trava abaixo aborta se isso mudou.
--
-- ROLLBACK: scripts/sql/v226_qps_laudo_igual_drps.rollback.sql (NÃO recria a
-- tabela apagada — ela estava vazia; recriar é só rodar a migration original).
BEGIN;

-- ── 1) Texto padrão: módulo 'qps' ───────────────────────────────────────────
ALTER TABLE public.textos_padrao DROP CONSTRAINT IF EXISTS textos_padrao_modulo_check;
ALTER TABLE public.textos_padrao ADD CONSTRAINT textos_padrao_modulo_check
  CHECK (modulo = ANY (ARRAY['sst','conformidade','nao_conformidade','analise_quimicos',
                             'apreciacao_maquinas','aep','aet','psicossocial','plano_acao','qps']));

-- Seções do sistema (mesma lista de MODULO_CONFIGS.qps em lib/textos-padrao/types.ts;
-- o hook useSeedCapitulosFixos faria o mesmo pela tela). Idempotente por slug.
INSERT INTO public.textos_padrao
  (id_capitulo, modulo, ordem, titulo, conteudo, tipo, slug_fixo, ativo, orientacao, quebra_pagina, posicao_pdf, created_at)
SELECT 'TXT-' || upper(substr(md5(random()::text || s.slug), 1, 8)),
       'qps', s.ordem, s.titulo, NULL, 'fixo', s.slug, true, s.orientacao, s.quebra, 'inicio', now()
  FROM (VALUES
    (10,  'sumario',               'Sumário',                            'retrato',  'nova'),
    (20,  'identificacao_empresa', 'Identificação da Empresa',           'retrato',  'nova'),
    (70,  'qps_caracterizacao',    'Caracterização dos Trabalhadores',   'retrato',  'continua'),
    (80,  'qps_analise_setor',     'Análise por Setor',                  'retrato',  'continua'),
    (100, 'qps_conclusao',         'Conclusão Técnica Consolidada',      'retrato',  'nova'),
    (110, 'qps_plano_medidas',     'Plano de Medidas de Controle',       'retrato',  'continua'),
    (115, 'qps_plano_acao_5w2h',   'Plano de Ação 5W2H',                 'paisagem', 'nova'),
    (118, 'qps_revisao',           'Revisão e Monitoramento',            'retrato',  'nova'),
    (120, 'qps_assinatura',        'Assinatura Técnica',                 'retrato',  'nova')
  ) AS s(ordem, slug, titulo, orientacao, quebra)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.textos_padrao t
    WHERE t.modulo = 'qps' AND t.tipo = 'fixo' AND t.slug_fixo = s.slug);

-- ── 2) Metadados do laudo na aplicação ──────────────────────────────────────
-- Sem DEFAULT no ADD COLUMN: com ele o Postgres preencheria as linhas
-- existentes com a data de HOJE (ensaio pegou: 28 aplicações em 17/09).
ALTER TABLE public.qps_aplicacoes
  ADD COLUMN IF NOT EXISTS crp             text,
  ADD COLUMN IF NOT EXISTS data_elaboracao date;
UPDATE public.qps_aplicacoes
   SET data_elaboracao = (criado_em AT TIME ZONE 'America/Sao_Paulo')::date
 WHERE data_elaboracao IS NULL;
ALTER TABLE public.qps_aplicacoes ALTER COLUMN data_elaboracao SET DEFAULT CURRENT_DATE;
COMMENT ON COLUMN public.qps_aplicacoes.crp IS
  'v226 — CRP do responsável, impresso no cabeçalho e na assinatura do laudo.';
COMMENT ON COLUMN public.qps_aplicacoes.data_elaboracao IS
  'v226 — data de elaboração impressa no laudo; nasce com a data de criação.';

-- ── 3) Apaga o plano simples, substituído pelo 5W2H (v225) ──────────────────
DO $$
DECLARE n bigint;
BEGIN
  IF to_regclass('public.qps_planos_acao') IS NULL THEN
    RAISE NOTICE 'v226: qps_planos_acao já não existe.';
    RETURN;
  END IF;
  EXECUTE 'SELECT count(*) FROM public.qps_planos_acao' INTO n;
  IF n > 0 THEN
    RAISE EXCEPTION 'v226: qps_planos_acao tem % linha(s) — era para estar vazia. Nada foi apagado.', n;
  END IF;
  PERFORM public.auditoria_desativar('qps_planos_acao');
  DELETE FROM public.auditoria_tabelas WHERE tabela = 'qps_planos_acao';
  EXECUTE 'DROP TABLE public.qps_planos_acao';
END $$;


COMMIT;

NOTIFY pgrst, 'reload schema';
