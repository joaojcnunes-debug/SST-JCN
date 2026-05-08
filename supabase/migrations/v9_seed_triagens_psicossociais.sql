-- ============================================================
-- V9: Seed de triagens + modelos para os tipos psicossociais
-- ============================================================
-- Replica a estrutura do IAPAT Ambiental (triagens + modelos +
-- links) para os outros 4 tipos psicossociais. Conteúdo curado
-- com perguntas e riscos comuns de PGR pra cada domínio.
--
-- Tipos cobertos:
--   - IAPAT Complexidade Laboral
--   - IAPAT Impactos de Alto Risco
--   - IAPAT Relações Interpessoais (criado se não existir)
--   - Psicossocial
--
-- Idempotente: usa md5 determinístico nos IDs e ON CONFLICT.
-- Admin pode adicionar/editar/remover qualquer item via Catálogo.
-- ============================================================

-- 1) Garante "IAPAT Relações Interpessoais" (não está nos tipos default)
INSERT INTO public.tipos_risco (id_tipo, nome, icone, ordem, ativo, sistema)
SELECT 'TIP_iapat_relacoes', 'IAPAT Relações Interpessoais', '👥', 9, true, false
WHERE NOT EXISTS (
  SELECT 1 FROM public.tipos_risco WHERE nome = 'IAPAT Relações Interpessoais'
);


-- ============================================================
-- IAPAT COMPLEXIDADE LABORAL
-- ============================================================
WITH t AS (SELECT id_tipo FROM public.tipos_risco WHERE nome = 'IAPAT Complexidade Laboral')
INSERT INTO public.triagens_tipo (id_triagem, id_tipo, texto, ordem, ativo)
SELECT 'TRI_' || md5(t.id_tipo || ':' || v.texto), t.id_tipo, v.texto, v.ordem, true
FROM t CROSS JOIN (VALUES
  ('Há demandas cognitivas elevadas (concentração intensa, decisões complexas)?', 0),
  ('Há pressão de tempo, prazos apertados ou ritmo acelerado?', 1),
  ('Há sobrecarga de informações ou múltiplas tarefas simultâneas?', 2)
) AS v(texto, ordem)
ON CONFLICT DO NOTHING;

WITH t AS (SELECT id_tipo FROM public.tipos_risco WHERE nome = 'IAPAT Complexidade Laboral')
INSERT INTO public.modelos_risco (id_modelo, id_tipo, agente, ordem, ativo)
SELECT 'MOD_' || md5(t.id_tipo || ':' || v.agente), t.id_tipo, v.agente, v.ordem, true
FROM t CROSS JOIN (VALUES
  ('Estresse por sobrecarga cognitiva', 0),
  ('Fadiga mental por excesso de prazos', 1),
  ('Erro humano por sobrecarga informacional', 2),
  ('Estresse decisório', 3)
) AS v(agente, ordem)
ON CONFLICT DO NOTHING;

-- Links via JOIN-by-name pra ser resiliente a modelos pré-existentes
-- com id_modelo diferente do md5 que estamos gerando.
WITH t AS (SELECT id_tipo FROM public.tipos_risco WHERE nome = 'IAPAT Complexidade Laboral')
INSERT INTO public.triagens_modelo (id_triagem, id_modelo, ordem)
SELECT tri.id_triagem, mod.id_modelo, v.ordem
FROM t
JOIN public.triagens_tipo tri ON tri.id_tipo = t.id_tipo
JOIN public.modelos_risco mod ON mod.id_tipo = t.id_tipo
CROSS JOIN (VALUES
  ('Há demandas cognitivas elevadas (concentração intensa, decisões complexas)?', 'Estresse por sobrecarga cognitiva', 0),
  ('Há demandas cognitivas elevadas (concentração intensa, decisões complexas)?', 'Estresse decisório', 1),
  ('Há pressão de tempo, prazos apertados ou ritmo acelerado?', 'Fadiga mental por excesso de prazos', 0),
  ('Há sobrecarga de informações ou múltiplas tarefas simultâneas?', 'Erro humano por sobrecarga informacional', 0)
) AS v(tri_texto, mod_agente, ordem)
WHERE lower(tri.texto) = lower(v.tri_texto)
  AND lower(mod.agente) = lower(v.mod_agente)
ON CONFLICT DO NOTHING;


-- ============================================================
-- IAPAT IMPACTOS DE ALTO RISCO
-- ============================================================
WITH t AS (SELECT id_tipo FROM public.tipos_risco WHERE nome = 'IAPAT Impactos de Alto Risco')
INSERT INTO public.triagens_tipo (id_triagem, id_tipo, texto, ordem, ativo)
SELECT 'TRI_' || md5(t.id_tipo || ':' || v.texto), t.id_tipo, v.texto, v.ordem, true
FROM t CROSS JOIN (VALUES
  ('A atividade envolve risco de acidente com lesões graves ou fatais?', 0),
  ('Há exposição a violência ocupacional, ameaças ou agressões?', 1),
  ('Há manipulação de materiais perigosos ou operação de máquinas críticas?', 2)
) AS v(texto, ordem)
ON CONFLICT DO NOTHING;

WITH t AS (SELECT id_tipo FROM public.tipos_risco WHERE nome = 'IAPAT Impactos de Alto Risco')
INSERT INTO public.modelos_risco (id_modelo, id_tipo, agente, ordem, ativo)
SELECT 'MOD_' || md5(t.id_tipo || ':' || v.agente), t.id_tipo, v.agente, v.ordem, true
FROM t CROSS JOIN (VALUES
  ('Risco de lesão grave ou fatal', 0),
  ('Exposição a violência ocupacional', 1),
  ('Acidente com máquinas críticas', 2),
  ('Exposição a materiais perigosos', 3)
) AS v(agente, ordem)
ON CONFLICT DO NOTHING;

WITH t AS (SELECT id_tipo FROM public.tipos_risco WHERE nome = 'IAPAT Impactos de Alto Risco')
INSERT INTO public.triagens_modelo (id_triagem, id_modelo, ordem)
SELECT tri.id_triagem, mod.id_modelo, v.ordem
FROM t
JOIN public.triagens_tipo tri ON tri.id_tipo = t.id_tipo
JOIN public.modelos_risco mod ON mod.id_tipo = t.id_tipo
CROSS JOIN (VALUES
  ('A atividade envolve risco de acidente com lesões graves ou fatais?', 'Risco de lesão grave ou fatal', 0),
  ('A atividade envolve risco de acidente com lesões graves ou fatais?', 'Acidente com máquinas críticas', 1),
  ('Há exposição a violência ocupacional, ameaças ou agressões?', 'Exposição a violência ocupacional', 0),
  ('Há manipulação de materiais perigosos ou operação de máquinas críticas?', 'Exposição a materiais perigosos', 0)
) AS v(tri_texto, mod_agente, ordem)
WHERE lower(tri.texto) = lower(v.tri_texto)
  AND lower(mod.agente) = lower(v.mod_agente)
ON CONFLICT DO NOTHING;


-- ============================================================
-- IAPAT RELAÇÕES INTERPESSOAIS
-- ============================================================
WITH t AS (SELECT id_tipo FROM public.tipos_risco WHERE nome = 'IAPAT Relações Interpessoais')
INSERT INTO public.triagens_tipo (id_triagem, id_tipo, texto, ordem, ativo)
SELECT 'TRI_' || md5(t.id_tipo || ':' || v.texto), t.id_tipo, v.texto, v.ordem, true
FROM t CROSS JOIN (VALUES
  ('Há conflitos frequentes com chefia, colegas ou subordinados?', 0),
  ('Há falta de apoio social, isolamento profissional ou bullying?', 1),
  ('Há comunicação deficiente entre equipes ou turnos?', 2)
) AS v(texto, ordem)
ON CONFLICT DO NOTHING;

WITH t AS (SELECT id_tipo FROM public.tipos_risco WHERE nome = 'IAPAT Relações Interpessoais')
INSERT INTO public.modelos_risco (id_modelo, id_tipo, agente, ordem, ativo)
SELECT 'MOD_' || md5(t.id_tipo || ':' || v.agente), t.id_tipo, v.agente, v.ordem, true
FROM t CROSS JOIN (VALUES
  ('Conflito hierárquico com chefia', 0),
  ('Conflito horizontal entre colegas', 1),
  ('Isolamento social no trabalho', 2),
  ('Comunicação ineficaz entre equipes', 3),
  ('Bullying / assédio moral', 4)
) AS v(agente, ordem)
ON CONFLICT DO NOTHING;

WITH t AS (SELECT id_tipo FROM public.tipos_risco WHERE nome = 'IAPAT Relações Interpessoais')
INSERT INTO public.triagens_modelo (id_triagem, id_modelo, ordem)
SELECT tri.id_triagem, mod.id_modelo, v.ordem
FROM t
JOIN public.triagens_tipo tri ON tri.id_tipo = t.id_tipo
JOIN public.modelos_risco mod ON mod.id_tipo = t.id_tipo
CROSS JOIN (VALUES
  ('Há conflitos frequentes com chefia, colegas ou subordinados?', 'Conflito hierárquico com chefia', 0),
  ('Há conflitos frequentes com chefia, colegas ou subordinados?', 'Conflito horizontal entre colegas', 1),
  ('Há falta de apoio social, isolamento profissional ou bullying?', 'Isolamento social no trabalho', 0),
  ('Há falta de apoio social, isolamento profissional ou bullying?', 'Bullying / assédio moral', 1),
  ('Há comunicação deficiente entre equipes ou turnos?', 'Comunicação ineficaz entre equipes', 0)
) AS v(tri_texto, mod_agente, ordem)
WHERE lower(tri.texto) = lower(v.tri_texto)
  AND lower(mod.agente) = lower(v.mod_agente)
ON CONFLICT DO NOTHING;


-- ============================================================
-- PSICOSSOCIAL
-- ============================================================
WITH t AS (SELECT id_tipo FROM public.tipos_risco WHERE nome = 'Psicossocial')
INSERT INTO public.triagens_tipo (id_triagem, id_tipo, texto, ordem, ativo)
SELECT 'TRI_' || md5(t.id_tipo || ':' || v.texto), t.id_tipo, v.texto, v.ordem, true
FROM t CROSS JOIN (VALUES
  ('Há sinais de estresse crônico, ansiedade ou exaustão emocional?', 0),
  ('Há indícios de assédio moral, sexual ou discriminação?', 1),
  ('Há jornada exaustiva ou desbalanceio entre vida pessoal e trabalho?', 2)
) AS v(texto, ordem)
ON CONFLICT DO NOTHING;

WITH t AS (SELECT id_tipo FROM public.tipos_risco WHERE nome = 'Psicossocial')
INSERT INTO public.modelos_risco (id_modelo, id_tipo, agente, ordem, ativo)
SELECT 'MOD_' || md5(t.id_tipo || ':' || v.agente), t.id_tipo, v.agente, v.ordem, true
FROM t CROSS JOIN (VALUES
  ('Estresse ocupacional crônico', 0),
  ('Síndrome de Burnout', 1),
  ('Ansiedade ocupacional', 2),
  ('Assédio moral', 3),
  ('Assédio sexual', 4),
  ('Discriminação no ambiente de trabalho', 5),
  ('Sobrecarga horária', 6)
) AS v(agente, ordem)
ON CONFLICT DO NOTHING;

WITH t AS (SELECT id_tipo FROM public.tipos_risco WHERE nome = 'Psicossocial')
INSERT INTO public.triagens_modelo (id_triagem, id_modelo, ordem)
SELECT tri.id_triagem, mod.id_modelo, v.ordem
FROM t
JOIN public.triagens_tipo tri ON tri.id_tipo = t.id_tipo
JOIN public.modelos_risco mod ON mod.id_tipo = t.id_tipo
CROSS JOIN (VALUES
  ('Há sinais de estresse crônico, ansiedade ou exaustão emocional?', 'Estresse ocupacional crônico', 0),
  ('Há sinais de estresse crônico, ansiedade ou exaustão emocional?', 'Síndrome de Burnout', 1),
  ('Há sinais de estresse crônico, ansiedade ou exaustão emocional?', 'Ansiedade ocupacional', 2),
  ('Há indícios de assédio moral, sexual ou discriminação?', 'Assédio moral', 0),
  ('Há indícios de assédio moral, sexual ou discriminação?', 'Assédio sexual', 1),
  ('Há indícios de assédio moral, sexual ou discriminação?', 'Discriminação no ambiente de trabalho', 2),
  ('Há jornada exaustiva ou desbalanceio entre vida pessoal e trabalho?', 'Sobrecarga horária', 0)
) AS v(tri_texto, mod_agente, ordem)
WHERE lower(tri.texto) = lower(v.tri_texto)
  AND lower(mod.agente) = lower(v.mod_agente)
ON CONFLICT DO NOTHING;
