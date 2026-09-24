-- V53 — Posicionamento configurável dos capítulos de Texto Padrão no PDF
--
-- Atualmente o componente `TextosPadraoPrint` renderiza TODOS os capítulos
-- ativos em uma única posição fixa (geralmente antes do conteúdo principal).
-- Esta migração introduz `posicao_pdf` por capítulo, permitindo que o
-- admin organize a ordem do relatório (capa → sumário → intro → análise →
-- conclusão → medidas → considerações finais).
--
-- Valores possíveis (em ordem de aparição no PDF):
--   - 'inicio'           → antes do sumário (capa, dedicatória etc)
--   - 'apos_sumario'     → entre o sumário e a análise principal
--                          (intro, metodologia, fundamentação)
--   - 'apos_setores'     → entre a análise por setor e a conclusão geral
--   - 'apos_conclusao'   → entre conclusão geral e medidas/monitoramento
--   - 'apos_medidas'     → entre as seções de gestão e o fim
--   - 'fim'              → última coisa do PDF (considerações finais)
--
-- Nullable com default 'inicio' — capítulos existentes herdam o comportamento
-- antigo (renderizar no começo).

-- Tabela genérica (SST, Conformidade, RNC, Análise de Químicos, Apreciação NR-12)
ALTER TABLE public.textos_padrao
  ADD COLUMN IF NOT EXISTS posicao_pdf TEXT NOT NULL DEFAULT 'inicio';

ALTER TABLE public.textos_padrao
  DROP CONSTRAINT IF EXISTS textos_padrao_posicao_pdf_check;
ALTER TABLE public.textos_padrao
  ADD CONSTRAINT textos_padrao_posicao_pdf_check
  CHECK (posicao_pdf IN (
    'inicio',
    'apos_sumario',
    'apos_setores',
    'apos_conclusao',
    'apos_medidas',
    'fim'
  ));

CREATE INDEX IF NOT EXISTS idx_textos_padrao_modulo_posicao
  ON public.textos_padrao (modulo, posicao_pdf, ordem);

COMMENT ON COLUMN public.textos_padrao.posicao_pdf IS
  'Posição do capítulo no PDF final: inicio | apos_sumario | apos_setores | apos_conclusao | apos_medidas | fim';


-- Tabela específica do DRPS (Psicossocial) — herdou estrutura própria da v24
ALTER TABLE public.drps_texto_padrao
  ADD COLUMN IF NOT EXISTS posicao_pdf TEXT NOT NULL DEFAULT 'inicio';

ALTER TABLE public.drps_texto_padrao
  DROP CONSTRAINT IF EXISTS drps_texto_padrao_posicao_pdf_check;
ALTER TABLE public.drps_texto_padrao
  ADD CONSTRAINT drps_texto_padrao_posicao_pdf_check
  CHECK (posicao_pdf IN (
    'inicio',
    'apos_sumario',
    'apos_setores',
    'apos_conclusao',
    'apos_medidas',
    'fim'
  ));

CREATE INDEX IF NOT EXISTS idx_drps_texto_padrao_posicao
  ON public.drps_texto_padrao (posicao_pdf, ordem)
  WHERE ativo = TRUE;

COMMENT ON COLUMN public.drps_texto_padrao.posicao_pdf IS
  'Posição do capítulo no PDF do relatório DRPS: inicio | apos_sumario | apos_setores | apos_conclusao | apos_medidas | fim';
