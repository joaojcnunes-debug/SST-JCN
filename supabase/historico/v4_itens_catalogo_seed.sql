-- ============================================================
-- V4 SEED: Agentes pré-cadastrados (migrados de AGENTES_SUGERIDOS)
-- ============================================================
-- Popula a categoria `agente` do catálogo com os agentes que antes
-- viviam hardcoded em lib/constants.ts. Idempotente — pode ser
-- rodado várias vezes, conflitos no unique index (id_tipo, categoria,
-- lower(texto)) são ignorados.
--
-- Lookup por NOME do tipo (não id_tipo), pra não depender do slug
-- exato gerado quando o tipo foi cadastrado.
-- ============================================================

INSERT INTO public.itens_catalogo_tipo (id_item, id_tipo, categoria, texto, ordem, ativo)
SELECT
  'CAT_' || md5(t.id_tipo || ':agente:' || lower(v.texto)),
  t.id_tipo,
  'agente',
  v.texto,
  v.ordem,
  true
FROM public.tipos_risco t
JOIN (VALUES
  -- Acidente
  ('Acidente', 'Queda em mesmo nível', 0),
  ('Acidente', 'Queda de altura', 1),
  ('Acidente', 'Choque elétrico', 2),
  ('Acidente', 'Corte/Perfuração', 3),
  ('Acidente', 'Esmagamento', 4),
  ('Acidente', 'Projeção de partículas', 5),
  -- Físico
  ('Físico', 'Ruído contínuo', 0),
  ('Físico', 'Ruído de impacto', 1),
  ('Físico', 'Calor', 2),
  ('Físico', 'Frio', 3),
  ('Físico', 'Vibração', 4),
  ('Físico', 'Radiação não ionizante', 5),
  ('Físico', 'Radiação ionizante', 6),
  ('Físico', 'Umidade', 7),
  ('Físico', 'Pressão atmosférica', 8),
  -- Químico
  ('Químico', 'Poeira', 0),
  ('Químico', 'Fumo metálico', 1),
  ('Químico', 'Névoa', 2),
  ('Químico', 'Neblina', 3),
  ('Químico', 'Gases', 4),
  ('Químico', 'Vapores orgânicos', 5),
  ('Químico', 'Solventes', 6),
  ('Químico', 'Produtos químicos em geral', 7),
  -- Biológico
  ('Biológico', 'Bactérias', 0),
  ('Biológico', 'Vírus', 1),
  ('Biológico', 'Fungos', 2),
  ('Biológico', 'Parasitas', 3),
  ('Biológico', 'Bacilos', 4),
  ('Biológico', 'Sangue/fluidos corpóreos', 5),
  -- Ergonômico
  ('Ergonômico', 'Postura inadequada', 0),
  ('Ergonômico', 'Esforço físico intenso', 1),
  ('Ergonômico', 'Levantamento de peso', 2),
  ('Ergonômico', 'Movimentos repetitivos', 3),
  ('Ergonômico', 'Mobiliário inadequado', 4),
  ('Ergonômico', 'Iluminação inadequada', 5),
  -- Psicossocial
  ('Psicossocial', 'Sobrecarga de trabalho', 0),
  ('Psicossocial', 'Assédio moral', 1),
  ('Psicossocial', 'Pressão por produtividade', 2),
  ('Psicossocial', 'Conflitos interpessoais', 3),
  ('Psicossocial', 'Trabalho monótono', 4),
  -- Ambiental
  ('Ambiental', 'Resíduos sólidos', 0),
  ('Ambiental', 'Efluentes líquidos', 1),
  ('Ambiental', 'Emissões atmosféricas', 2),
  ('Ambiental', 'Contaminação do solo', 3),
  -- IAPAT Complexidade Laboral
  ('IAPAT Complexidade Laboral', 'Demanda cognitiva', 0),
  ('IAPAT Complexidade Laboral', 'Demanda emocional', 1),
  ('IAPAT Complexidade Laboral', 'Demanda física', 2),
  -- IAPAT Impactos de Alto Risco
  ('IAPAT Impactos de Alto Risco', 'Atividade em altura', 0),
  ('IAPAT Impactos de Alto Risco', 'Espaço confinado', 1),
  ('IAPAT Impactos de Alto Risco', 'Eletricidade', 2),
  ('IAPAT Impactos de Alto Risco', 'Trabalho a quente', 3)
) AS v(nome, texto, ordem) ON v.nome = t.nome
ON CONFLICT DO NOTHING;
