-- v243: o laudo da QAP ganha CAPA, RESUMO e METODOLOGIA, e o PLANO DE AÇÃO
-- sai do laudo. Pedido do João Marcos em 18/09/2026 (tarefa "PAINEL
-- (QUESTIONÁRIOS PSICOSSOCIAIS)"), decisões confirmadas por ele em 22/09:
--
--   1. Capa: "pode ser a mesma da DRPS" — copiada do capítulo Capa do módulo
--      'psicossocial' (mesma arte de fundo, mesmas 3 caixas).
--   2. Resumo: capítulo editável NOVO, vazio, para eles escreverem. Nasce
--      DESLIGADO (ativo=false) de propósito: um capítulo editável vazio e
--      ligado imprimiria uma seção numerada em branco nas 28 aplicações que
--      já existem. Ligar é um clique na tela Texto Padrão.
--   3. Metodologia: copiada do DRPS, a pedido dele — ciente de que o texto
--      descreve o DRPS (13 eixos, escala 0–4) e que a QAP terá de reescrevê-lo.
--      É `tipo='editavel'`: o conteúdo é só o rascunho inicial.
--   4. Plano de Ação 5W2H: `ativo=false`. Para de imprimir no laudo. O item do
--      menu, o card e o alerta saem no código (v0.3.637).
--
-- AS 3 VARIÁVEIS QUE NÃO EXISTEM NA QAP. Copiar o texto do DRPS cru deixaria
-- `{{data_conclusao}}`, `{{data_carimbo_inicio}}` e `{{importado}}` escritos
-- LITERALMENTE no PDF (substituirVariaveisTexto devolve o token quando a chave
-- não existe — lib/textos-padrao/variaveis.ts). Trocadas pelas equivalentes de
-- lib/qps/variaveis.ts: data_elaboracao, periodo_inicio, periodo_fim.
--
-- ROLLBACK: scripts/sql/v243_rollback_qps_capa_resumo_metodologia.sql
-- NO JCN: duas diferencas em relacao ao painel.
-- 1) La esta migration CLONA a Capa e a Metodologia do DRPS (textos_padrao
--    modulo='psicossocial', tipo='editavel'). Aqui nao ha o que clonar: nem
--    textos_padrao/psicossocial nem drps_texto_padrao tem uma linha sequer —
--    o DRPS do JCN nunca teve capitulo cadastrado. Entao entra a mesma
--    ESTRUTURA (Capa, Resumo, Metodologia; reordenacao dos fixos; 5W2H fora
--    do PDF) com conteudo VAZIO, para preencher na tela de textos padrao.
--    Nada de conteudo inventado.
-- 2) textos_padrao aqui nao tem as colunas bloqueado/obrigatorio.

BEGIN;

-- ── Guarda: os capítulos de origem do DRPS têm de existir ───────────────────
-- ── 1) Abre a ordem para os três capítulos novos ────────────────────────────
-- Alvo:  0 Capa · 10 Sumário · 15 Resumo · 20 Identificação · 25 Metodologia
--        30 Caracterização · 40 Análise · 50 Conclusão · 60 Plano de Medidas
--        70 Plano de Ação (desligado) · 80 Revisão · 90 Assinatura
-- O trigger de snapshot ignora UPDATE que só mexe em `ordem`/`ativo`, então
-- isto não cria versão nenhuma no histórico dos capítulos.
UPDATE public.textos_padrao t SET ordem = v.ordem
  FROM (VALUES
    ('sumario',               10),
    ('identificacao_empresa', 20),
    ('qps_caracterizacao',    30),
    ('qps_analise_setor',     40),
    ('qps_conclusao',         50),
    ('qps_plano_medidas',     60),
    ('qps_plano_acao_5w2h',   70),
    ('qps_revisao',           80),
    ('qps_assinatura',        90)
  ) AS v(slug, ordem)
 WHERE t.modulo = 'qps' AND t.tipo = 'fixo' AND t.slug_fixo = v.slug AND t.ordem IS DISTINCT FROM v.ordem;

-- ── 2) Capa — cópia da do DRPS ──────────────────────────────────────────────
INSERT INTO public.textos_padrao
  (id_capitulo, modulo, ordem, titulo, conteudo, bg_imagem_url, caixas_texto,
   orientacao, quebra_pagina, posicao_pdf, ativo, tipo, slug_fixo, created_at)
SELECT 'TXT-' || upper(substr(md5(random()::text || 'qps-capa'), 1, 8)),
       'qps', 0, 'Capa', NULL, NULL, NULL,
       'retrato', 'nova', 'inicio', true, 'editavel', NULL, now()
 WHERE NOT EXISTS (SELECT 1 FROM public.textos_padrao q
                    WHERE q.modulo = 'qps' AND q.tipo = 'editavel' AND q.titulo = 'Capa');

INSERT INTO public.textos_padrao
  (id_capitulo, modulo, ordem, titulo, conteudo, bg_imagem_url, caixas_texto,
   orientacao, quebra_pagina, posicao_pdf, ativo, tipo, slug_fixo, created_at)
SELECT 'TXT-' || upper(substr(md5(random()::text || 'qps-resumo'), 1, 8)),
       'qps', 15, 'Resumo', NULL, NULL, NULL,
       'retrato', 'nova', 'inicio', false, 'editavel', NULL, now()
 WHERE NOT EXISTS (SELECT 1 FROM public.textos_padrao q
                    WHERE q.modulo = 'qps' AND q.tipo = 'editavel' AND q.titulo = 'Resumo');

INSERT INTO public.textos_padrao
  (id_capitulo, modulo, ordem, titulo, conteudo, bg_imagem_url, caixas_texto,
   orientacao, quebra_pagina, posicao_pdf, ativo, tipo, slug_fixo, created_at)
SELECT 'TXT-' || upper(substr(md5(random()::text || 'qps-metodologia'), 1, 8)),
       'qps', 25, 'Metodologia', NULL, NULL, NULL,
       'retrato', 'nova', 'inicio', true, 'editavel', NULL, now()
 WHERE NOT EXISTS (SELECT 1 FROM public.textos_padrao q
                    WHERE q.modulo = 'qps' AND q.tipo = 'editavel' AND q.titulo = 'Metodologia');

UPDATE public.textos_padrao
   SET ativo = false
 WHERE modulo = 'qps' AND tipo = 'fixo' AND slug_fixo = 'qps_plano_acao_5w2h' AND ativo;

-- ── Conferência: o laudo tem de ficar exatamente com estes 12 capítulos ─────
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.textos_padrao WHERE modulo = 'qps';
  IF n <> 12 THEN
    RAISE EXCEPTION 'v243: esperava 12 capítulos em qps, tenho %.', n;
  END IF;
  SELECT count(*) INTO n FROM public.textos_padrao
   WHERE modulo = 'qps' AND tipo = 'editavel' AND titulo IN ('Capa','Resumo','Metodologia');
  IF n <> 3 THEN
    RAISE EXCEPTION 'v243: esperava Capa, Resumo e Metodologia, tenho % deles.', n;
  END IF;
END $$;


COMMIT;
