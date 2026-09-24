-- V182 — SEED do questionário PER (Pesquisa Estratégica de Riscos)
--
-- ─── De onde veio ──────────────────────────────────────────────────────────
--
-- Transcrito do PDF do Google Forms que a Sarah Forny montou
-- ("Cópia de PER - Para envio - Google Formulários.pdf", 9 páginas, 24/08).
-- É o PRIMEIRO questionário do painel a usar o padrão da v180: cada pergunta
-- tem as suas próprias alternativas, sem escala numérica. Até aqui a
-- funcionalidade existia e nenhuma das 71 perguntas da base usava — era por
-- isso que a Sarah dizia que "o padrão novo não aparece".
--
-- ⚠️ A ORDEM DAS CATEGORIAS É PARTE DO DADO, NÃO É ESTÉTICA ────────────────
--
-- A importação casa coluna do Forms com pergunta POR POSIÇÃO, e a lista
-- canônica é montada como (categoria.ordem → pergunta.ordem). Por isso as 8
-- categorias abaixo são BLOCOS CONTÍGUOS da numeração do formulário: a lista
-- achatada tem de dar 2,3,4,…,21, na ordem exata das colunas.
--
-- Agrupar por afinidade temática sem respeitar isso (juntar a 21 com as de
-- organização, por exemplo) faria toda resposta ser gravada na pergunta
-- seguinte e embaralharia a matriz setor × dimensão inteira. Mexer na ordem
-- daqui exige mexer no Google Forms junto.
--
-- ─── Decisões do Sanmyo em 2026-08-25 ──────────────────────────────────────
--
--  · Pergunta 12 é a ÚNICA `direta`: "Nada exigente" é o melhor e "Exige
--    atenção o tempo todo" é o pior — ao contrário das outras 19, onde a
--    primeira alternativa é a pior.
--  · Pergunta 15 (home office) entra como `invertida` — mais presencial,
--    mais exposição — e fica sozinha na dimensão "Modalidade de trabalho",
--    para não contaminar as demais.
--  · Pergunta 17 teve a 2ª e a 3ª alternativas TROCADAS em relação ao PDF:
--    "Exige um pouco de atenção" soava mais leve que "Algumas atividades têm
--    riscos" e quebrava a escala. ⚠️ O Google Forms precisa da mesma troca,
--    senão o texto não casa na importação e a linha é recusada.
--
-- A Sarah revisa o conteúdo depois e corrige o que for dela.
--
-- Reversível: scripts/sql/v182_seed_per_rollback.sql

DO $seed$
DECLARE
  v_tipo uuid;
  v_cat  uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM qps_tipos WHERE nome = 'PER - Pesquisa Estratégica de Riscos') THEN
    RAISE NOTICE 'PER ja cadastrado — nada a fazer';
    RETURN;
  END IF;

  INSERT INTO qps_tipos (nome, descricao, instrucoes, escala_min, escala_max, ativo)
  VALUES (
    'PER - Pesquisa Estratégica de Riscos',
    'Pesquisa ampla de riscos do ambiente e da organização do trabalho, com alternativas próprias por pergunta.',
    'Cada pergunta tem as suas alternativas, na ordem do formulário. A escala numérica do tipo (1 a 5) só vale para pergunta que não tenha alternativas próprias.',
    1, 5, true
  )
  RETURNING id_tipo INTO v_tipo;


  INSERT INTO qps_categorias (id_tipo, nome, ordem)
  VALUES (v_tipo, 'Ambiente físico', 1)
  RETURNING id_categoria INTO v_cat;

  INSERT INTO qps_perguntas (id_categoria, texto, logica, ordem, ativo, opcoes)
  VALUES (v_cat, 'A temperatura do local de trabalho está confortável para você?', 'invertida', 1, true, to_jsonb(ARRAY['Muito quente ou muito frio', 'Às vezes desconfortável', 'Dá para trabalhar, mas poderia ser melhor', 'Geralmente boa', 'Sempre agradável']::text[]));  -- Forms nº 2
  INSERT INTO qps_perguntas (id_categoria, texto, logica, ordem, ativo, opcoes)
  VALUES (v_cat, 'O barulho no ambiente atrapalha seu trabalho?', 'invertida', 2, true, to_jsonb(ARRAY['Muito barulho, difícil de focar', 'Às vezes incomoda', 'Dá para lidar, mas poderia ser mais silencioso', 'Geralmente tranquilo', 'Ambiente sempre silencioso']::text[]));  -- Forms nº 3
  INSERT INTO qps_perguntas (id_categoria, texto, logica, ordem, ativo, opcoes)
  VALUES (v_cat, 'A iluminação do ambiente está boa para trabalhar?', 'invertida', 3, true, to_jsonb(ARRAY['Muito escuro ou muito forte', 'Um pouco desconfortável', 'Dá para trabalhar, mas poderia ser melhor', 'Geralmente boa', 'Iluminação perfeita']::text[]));  -- Forms nº 4
  INSERT INTO qps_perguntas (id_categoria, texto, logica, ordem, ativo, opcoes)
  VALUES (v_cat, 'O espaço disponível permite que você se movimente bem?', 'invertida', 4, true, to_jsonb(ARRAY['Muito apertado, difícil se mexer', 'Um pouco apertado, mas dá para se virar', 'Dá para trabalhar, mas poderia ser mais espaçoso', 'Espaço suficiente', 'Muito confortável para se movimentar']::text[]));  -- Forms nº 5
  INSERT INTO qps_perguntas (id_categoria, texto, logica, ordem, ativo, opcoes)
  VALUES (v_cat, 'O ambiente tem boa ventilação?', 'invertida', 5, true, to_jsonb(ARRAY['Muito abafado, precisa melhorar', 'Às vezes fica sem ventilação', 'Dá para suportar, mas poderia melhorar', 'Geralmente bem ventilado', 'Sempre bem arejado']::text[]));  -- Forms nº 6

  INSERT INTO qps_categorias (id_tipo, nome, ordem)
  VALUES (v_tipo, 'Ergonomia e recursos de trabalho', 2)
  RETURNING id_categoria INTO v_cat;

  INSERT INTO qps_perguntas (id_categoria, texto, logica, ordem, ativo, opcoes)
  VALUES (v_cat, 'Os móveis (cadeiras, mesas, etc.) são confortáveis?', 'invertida', 1, true, to_jsonb(ARRAY['Muito desconfortáveis', 'Poderiam ser melhores', 'Dá para usar, mas pode melhorar', 'Geralmente bons', 'Muito confortáveis']::text[]));  -- Forms nº 7
  INSERT INTO qps_perguntas (id_categoria, texto, logica, ordem, ativo, opcoes)
  VALUES (v_cat, 'Os equipamentos e ferramentas ajudam no seu trabalho?', 'invertida', 2, true, to_jsonb(ARRAY['Tornam o trabalho mais difícil', 'Poderiam ser melhores', 'São razoáveis, mas podem melhorar', 'Ajudam bastante', 'São ótimos e facilitam muito']::text[]));  -- Forms nº 8

  INSERT INTO qps_categorias (id_tipo, nome, ordem)
  VALUES (v_tipo, 'Organização e comunicação', 3)
  RETURNING id_categoria INTO v_cat;

  INSERT INTO qps_perguntas (id_categoria, texto, logica, ordem, ativo, opcoes)
  VALUES (v_cat, 'A organização da empresa está clara para você?', 'invertida', 1, true, to_jsonb(ARRAY['Não sei quem manda no quê', 'Algumas dúvidas sobre a estrutura', 'Dá para entender, mas nem sempre é claro', 'Geralmente bem organizado', 'Tudo muito bem definido']::text[]));  -- Forms nº 9
  INSERT INTO qps_perguntas (id_categoria, texto, logica, ordem, ativo, opcoes)
  VALUES (v_cat, 'O trabalho em equipe funciona bem?', 'invertida', 2, true, to_jsonb(ARRAY['Muita dificuldade de comunicação', 'Às vezes há desencontros', 'Funciona na maior parte do tempo', 'Quase sempre bem organizado', 'A equipe trabalha muito bem junta']::text[]));  -- Forms nº 10
  INSERT INTO qps_perguntas (id_categoria, texto, logica, ordem, ativo, opcoes)
  VALUES (v_cat, 'A empresa promove reuniões para alinhar o trabalho?', 'invertida', 3, true, to_jsonb(ARRAY['Nunca tem reunião', 'Tem poucas reuniões', 'Tem reuniões, mas poderiam ser mais produtivas', 'Geralmente bem organizadas', 'Sempre bem planejadas e úteis']::text[]));  -- Forms nº 11

  INSERT INTO qps_categorias (id_tipo, nome, ordem)
  VALUES (v_tipo, 'Demandas cognitivas e emocionais', 4)
  RETURNING id_categoria INTO v_cat;

  INSERT INTO qps_perguntas (id_categoria, texto, logica, ordem, ativo, opcoes)
  VALUES (v_cat, 'Seu trabalho exige muita atenção e concentração?', 'direta', 1, true, to_jsonb(ARRAY['Nada exigente', 'Pouca atenção necessária', 'Moderado, às vezes exige foco', 'Exige bastante atenção', 'Exige atenção o tempo todo']::text[]));  -- Forms nº 12
  INSERT INTO qps_perguntas (id_categoria, texto, logica, ordem, ativo, opcoes)
  VALUES (v_cat, 'O seu trabalho tem tarefas variadas ou é mais repetitivo?', 'invertida', 2, true, to_jsonb(ARRAY['Sempre igual, sem mudanças', 'Quase sempre igual', 'Às vezes muda um pouco', 'Frequentemente tem novidades', 'Sempre variado, nunca igual']::text[]));  -- Forms nº 13
  INSERT INTO qps_perguntas (id_categoria, texto, logica, ordem, ativo, opcoes)
  VALUES (v_cat, 'No seu trabalho, há situações que exigem calma e controle emocional?', 'invertida', 3, true, to_jsonb(ARRAY['Sempre situações difíceis', 'Muitas situações desafiadoras', 'Algumas situações estressantes', 'Poucas vezes é estressante', 'Quase nunca é estressante']::text[]));  -- Forms nº 14

  INSERT INTO qps_categorias (id_tipo, nome, ordem)
  VALUES (v_tipo, 'Modalidade de trabalho', 5)
  RETURNING id_categoria INTO v_cat;

  INSERT INTO qps_perguntas (id_categoria, texto, logica, ordem, ativo, opcoes)
  VALUES (v_cat, 'Seu trabalho pode ser feito de casa (home office) ou precisa estar na empresa?', 'invertida', 1, true, to_jsonb(ARRAY['Sempre na empresa', 'Quase sempre na empresa', 'Às vezes em casa, às vezes na empresa', 'Mais em casa do que na empresa', 'Sempre home office']::text[]));  -- Forms nº 15

  INSERT INTO qps_categorias (id_tipo, nome, ordem)
  VALUES (v_tipo, 'Segurança do trabalho', 6)
  RETURNING id_categoria INTO v_cat;

  INSERT INTO qps_perguntas (id_categoria, texto, logica, ordem, ativo, opcoes)
  VALUES (v_cat, 'O seu trabalho envolve algum tipo de cuidado extra com segurança?', 'invertida', 1, true, to_jsonb(ARRAY['Precisa de muita atenção com riscos', 'Algumas atividades exigem mais cuidado', 'Tem riscos, mas são controláveis', 'Poucas atividades oferecem risco', 'Nenhum risco']::text[]));  -- Forms nº 16
  INSERT INTO qps_perguntas (id_categoria, texto, logica, ordem, ativo, opcoes)
  VALUES (v_cat, 'Você trabalha com produtos ou atividades que exigem atenção à saúde e segurança?', 'invertida', 2, true, to_jsonb(ARRAY['Sim, exige muito cuidado', 'Algumas atividades têm riscos', 'Exige um pouco de atenção', 'Pouco risco', 'Nenhum risco identificado']::text[]));  -- Forms nº 17
  INSERT INTO qps_perguntas (id_categoria, texto, logica, ordem, ativo, opcoes)
  VALUES (v_cat, 'Você já soube de algum incidente ou acidente de trabalho na empresa?', 'invertida', 3, true, to_jsonb(ARRAY['Muitos acidentes aconteceram', 'Já aconteceram alguns', 'Poucos incidentes', 'Raramente acontece algo', 'Nunca ouvi falar de nenhum']::text[]));  -- Forms nº 18
  INSERT INTO qps_perguntas (id_categoria, texto, logica, ordem, ativo, opcoes)
  VALUES (v_cat, 'Você recebeu treinamento para fazer seu trabalho com segurança?', 'invertida', 4, true, to_jsonb(ARRAY['Nunca recebi treinamento', 'Recebi pouco treinamento', 'O treinamento foi básico', 'Treinamento bom e suficiente', 'Treinamento completo e atualizado']::text[]));  -- Forms nº 19

  INSERT INTO qps_categorias (id_tipo, nome, ordem)
  VALUES (v_tipo, 'Saúde percebida', 7)
  RETURNING id_categoria INTO v_cat;

  INSERT INTO qps_perguntas (id_categoria, texto, logica, ordem, ativo, opcoes)
  VALUES (v_cat, 'Como você avalia sua saúde (física e mental)?', 'invertida', 1, true, to_jsonb(ARRAY['Não me sinto saudável', 'Gostaria de estar melhor', 'Mediano', 'Me sinto satisfeito', 'Me sinto plenamente saudável']::text[]));  -- Forms nº 20

  INSERT INTO qps_categorias (id_tipo, nome, ordem)
  VALUES (v_tipo, 'Carga e distribuição do trabalho', 8)
  RETURNING id_categoria INTO v_cat;

  INSERT INTO qps_perguntas (id_categoria, texto, logica, ordem, ativo, opcoes)
  VALUES (v_cat, 'Você considera que as demandas do trabalho são bem distribuídas?', 'invertida', 1, true, to_jsonb(ARRAY['Há sobrecarga ou insuficiência de funcionários', 'Há demanda excessiva', 'Moderadamente, pode melhorar', 'São distribuídas adequadamente', 'São perfeitamente distribuídas']::text[]));  -- Forms nº 21

  RAISE NOTICE 'PER cadastrado: % categorias', 8;
END
$seed$;