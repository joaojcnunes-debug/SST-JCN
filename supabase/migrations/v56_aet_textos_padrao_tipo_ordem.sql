-- ─── v56 — Capítulos AET: tipo (fixo/editável), visibilidade e ordem global ──
--
-- Adiciona:
--   tipo         text  — 'fixo' (sistema) | 'editavel' (usuário)
--   slug_fixo    text  — identificador único do capítulo fixo (NULL para editáveis)
--   mostrar      bool  — visível no laudo?
--   ordem_global int   — posição global única (substitui a lógica posicao_pdf)
--
-- Migração dos dados existentes:
--   posicao_pdf = 'inicio'       → ordem_global = 0    + ordem*10
--   posicao_pdf = 'apos_sumario' → ordem_global = 1000 + ordem*10
--   posicao_pdf = 'apos_setores' → ordem_global = 3000 + ordem*10
--   outros                       → ordem_global = 5500 + ordem*10
--
-- Capítulos fixos semeados:
--   2000 → Agentes Ambientais por Setor      (Seção 9)
--   2500 → Análise Ergonômica do Trabalho    (Seção 13)
--   4000 → Fatores Psicossociais — QPS       (Seções 14-19)
--   5000 → Considerações Finais              (Seção 20)
--   5500 → Assinatura do Responsável Técnico

-- ── 1. Adicionar colunas ──────────────────────────────────────────────────────

ALTER TABLE aet_textos_padrao
  ADD COLUMN IF NOT EXISTS tipo         text    NOT NULL DEFAULT 'editavel',
  ADD COLUMN IF NOT EXISTS slug_fixo    text,
  ADD COLUMN IF NOT EXISTS mostrar      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ordem_global integer;

-- ── 2. Índice único parcial em slug_fixo (NULLs ficam fora da restrição) ─────

CREATE UNIQUE INDEX IF NOT EXISTS idx_aet_textos_padrao_slug_fixo
  ON aet_textos_padrao (slug_fixo)
  WHERE slug_fixo IS NOT NULL;

-- ── 3. Converter capítulos editáveis existentes para ordem_global ─────────────

UPDATE aet_textos_padrao
SET ordem_global = CASE
  WHEN posicao_pdf IS NULL OR posicao_pdf = 'inicio' THEN     0 + "ordem" * 10
  WHEN posicao_pdf = 'apos_sumario'                  THEN  1000 + "ordem" * 10
  WHEN posicao_pdf = 'apos_setores'                  THEN  3000 + "ordem" * 10
  ELSE                                                     5500 + "ordem" * 10
END
WHERE ordem_global IS NULL;

-- ── 4. Semear capítulos fixos do sistema (ignora se já existir) ───────────────

INSERT INTO aet_textos_padrao (titulo, conteudo, tipo, slug_fixo, ordem_global, mostrar, ordem, posicao_pdf)
SELECT v.titulo, NULL, 'fixo', v.slug_fixo, v.ordem_global, true, 0, NULL
FROM (VALUES
  ('Agentes Ambientais por Setor',       'aet_agentes_ambientais',    2000),
  ('Análise Ergonômica do Trabalho',     'aet_analise_ergonomica',    2500),
  ('Fatores Psicossociais (QPS)',        'aet_psicossocial',          4000),
  ('Considerações Finais',              'aet_consideracoes_finais',  5000),
  ('Assinatura do Responsável Técnico', 'aet_assinatura',            5500)
) AS v(titulo, slug_fixo, ordem_global)
WHERE NOT EXISTS (
  SELECT 1 FROM aet_textos_padrao t WHERE t.slug_fixo = v.slug_fixo
);
