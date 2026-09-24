-- V183 — troca o agrupamento do PER pelo da Sarah
--
-- ─── Por que existe ────────────────────────────────────────────────────────
--
-- A v182 cadastrou o PER com 8 dimensões que EU PROPUS a partir da leitura do
-- formulário. As perguntas e as alternativas vieram do PDF dela, mas os nomes
-- dos grupos e o recorte eram meus — conteúdo inventado, portanto.
--
-- Em 25/08 o Sanmyo trouxe o documento da Sarah ("Medidas de controle -
-- Google Docs.pdf", título interno "MÉTRICA PER - PAINEL"), que traz o
-- agrupamento de verdade: **4 grupos**, cada um com um texto de "Aspectos
-- avaliados" que o painel nem guardava. Esta migration substitui o meu pelo
-- dela e passa a preencher `qps_categorias.descricao`.
--
--   Ambiente físico ......... 7 perguntas (eu tinha partido em 5 + 2)
--   Relações interpessoais .. 3 (eu chamava "Organização e comunicação")
--   Complexidade laboral .... 4 (eu tinha isolado o home office num grupo só)
--   Impactos de alto risco .. 4 (eu chamava "Segurança do trabalho")
--
-- ─── As duas perguntas sem grupo ───────────────────────────────────────────
--
-- "Como você avalia sua saúde" e "Você considera que as demandas do trabalho
-- são bem distribuídas" existem no formulário e NÃO aparecem no documento da
-- métrica (conferido: o PDF tem 4 páginas e termina no treinamento; as 10
-- alternativas delas são exatamente as que faltam nas 90 do documento).
--
-- Em vez de inventar um grupo — que foi o erro da v182 — elas ficam num grupo
-- de espera, com nome que se explica sozinho na tela, até a Sarah dizer onde
-- entram. Decisão do Sanmyo em 25/08.
--
-- ─── A pergunta 17 volta ao original ───────────────────────────────────────
--
-- Hoje de manhã trocamos a 2ª com a 3ª alternativa dela ("Exige um pouco de
-- atenção" soava mais leve que "Algumas atividades têm riscos"). O documento
-- da Sarah traz a ordem original, e o Sanmyo decidiu que o documento vale.
-- A observação sobre o degrau invertido continua registrada, como observação.
--
-- ⚠️ A ORDEM SEGUE SENDO DADO. Os 5 grupos continuam blocos contíguos da
-- numeração do formulário: a lista achatada (categoria.ordem → pergunta.ordem)
-- tem de dar a mesma sequência das colunas. A migration confere isso no fim e
-- aborta se não bater.
--
-- Reversível: scripts/sql/v183_per_metrica_sarah_rollback.sql

DO $m$
DECLARE
  v_tipo uuid;
  v_cat  uuid;
  v_orfas int;
  v_seq  text;
BEGIN
  SELECT id_tipo INTO v_tipo FROM qps_tipos
  WHERE nome = 'PER - Pesquisa Estratégica de Riscos';
  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'PER nao esta cadastrado — rode a v182 antes';
  END IF;

  -- Rede de segurança: de qual categoria cada pergunta veio.
  CREATE TABLE IF NOT EXISTS backup_v183_per_categorias AS
  SELECT p.id_pergunta, p.id_categoria, p.ordem, p.opcoes,
         c.nome AS categoria_nome, c.ordem AS categoria_ordem, c.descricao AS categoria_descricao
  FROM qps_perguntas p
  JOIN qps_categorias c ON c.id_categoria = p.id_categoria
  WHERE c.id_tipo = v_tipo;


  -- ── Grupo 1: Ambiente físico (7 perguntas)
  SELECT id_categoria INTO v_cat FROM qps_categorias
  WHERE id_tipo = v_tipo AND nome = 'Ambiente físico';
  IF v_cat IS NULL THEN
    INSERT INTO qps_categorias (id_tipo, nome, descricao, ordem)
    VALUES (v_tipo, 'Ambiente físico', 'Aspectos avaliados: Neste grupo são avaliadas questões estruturais que podem influenciar no bem estar psicológico do trabalhador durante toda a jornada de trabalho e gerar sobrecarga física, mental e sensorial. Esse grupo é complementado com as devolutivas feitas na questão aberta ao final da pesquisa.', 1)
    RETURNING id_categoria INTO v_cat;
  ELSE
    UPDATE qps_categorias SET descricao = 'Aspectos avaliados: Neste grupo são avaliadas questões estruturais que podem influenciar no bem estar psicológico do trabalhador durante toda a jornada de trabalho e gerar sobrecarga física, mental e sensorial. Esse grupo é complementado com as devolutivas feitas na questão aberta ao final da pesquisa.', ordem = 1
    WHERE id_categoria = v_cat;
  END IF;

  UPDATE qps_perguntas SET id_categoria = v_cat, ordem = 1
  WHERE texto = 'A temperatura do local de trabalho está confortável para você?'
    AND id_categoria IN (SELECT id_categoria FROM qps_categorias WHERE id_tipo = v_tipo);
  IF NOT FOUND THEN RAISE EXCEPTION 'pergunta nao encontrada: %', 'A temperatura do local de trabalho está confortável para você?'; END IF;
  UPDATE qps_perguntas SET id_categoria = v_cat, ordem = 2
  WHERE texto = 'O barulho no ambiente atrapalha seu trabalho?'
    AND id_categoria IN (SELECT id_categoria FROM qps_categorias WHERE id_tipo = v_tipo);
  IF NOT FOUND THEN RAISE EXCEPTION 'pergunta nao encontrada: %', 'O barulho no ambiente atrapalha seu trabalho?'; END IF;
  UPDATE qps_perguntas SET id_categoria = v_cat, ordem = 3
  WHERE texto = 'A iluminação do ambiente está boa para trabalhar?'
    AND id_categoria IN (SELECT id_categoria FROM qps_categorias WHERE id_tipo = v_tipo);
  IF NOT FOUND THEN RAISE EXCEPTION 'pergunta nao encontrada: %', 'A iluminação do ambiente está boa para trabalhar?'; END IF;
  UPDATE qps_perguntas SET id_categoria = v_cat, ordem = 4
  WHERE texto = 'O espaço disponível permite que você se movimente bem?'
    AND id_categoria IN (SELECT id_categoria FROM qps_categorias WHERE id_tipo = v_tipo);
  IF NOT FOUND THEN RAISE EXCEPTION 'pergunta nao encontrada: %', 'O espaço disponível permite que você se movimente bem?'; END IF;
  UPDATE qps_perguntas SET id_categoria = v_cat, ordem = 5
  WHERE texto = 'O ambiente tem boa ventilação?'
    AND id_categoria IN (SELECT id_categoria FROM qps_categorias WHERE id_tipo = v_tipo);
  IF NOT FOUND THEN RAISE EXCEPTION 'pergunta nao encontrada: %', 'O ambiente tem boa ventilação?'; END IF;
  UPDATE qps_perguntas SET id_categoria = v_cat, ordem = 6
  WHERE texto = 'Os móveis (cadeiras, mesas, etc.) são confortáveis?'
    AND id_categoria IN (SELECT id_categoria FROM qps_categorias WHERE id_tipo = v_tipo);
  IF NOT FOUND THEN RAISE EXCEPTION 'pergunta nao encontrada: %', 'Os móveis (cadeiras, mesas, etc.) são confortáveis?'; END IF;
  UPDATE qps_perguntas SET id_categoria = v_cat, ordem = 7
  WHERE texto = 'Os equipamentos e ferramentas ajudam no seu trabalho?'
    AND id_categoria IN (SELECT id_categoria FROM qps_categorias WHERE id_tipo = v_tipo);
  IF NOT FOUND THEN RAISE EXCEPTION 'pergunta nao encontrada: %', 'Os equipamentos e ferramentas ajudam no seu trabalho?'; END IF;

  -- ── Grupo 2: Relações interpessoais (3 perguntas)
  SELECT id_categoria INTO v_cat FROM qps_categorias
  WHERE id_tipo = v_tipo AND nome = 'Relações interpessoais';
  IF v_cat IS NULL THEN
    INSERT INTO qps_categorias (id_tipo, nome, descricao, ordem)
    VALUES (v_tipo, 'Relações interpessoais', 'Aspectos avaliados: São avaliados nesse grupo, as dinâmicas interpessoais do trabalho, questões hierárquicas e clareza de papéis, bem como os relacionamentos dentro do âmbito laboral. Esse grupo é complementado com as devolutivas feitas na questão aberta ao final da pesquisa.', 2)
    RETURNING id_categoria INTO v_cat;
  ELSE
    UPDATE qps_categorias SET descricao = 'Aspectos avaliados: São avaliados nesse grupo, as dinâmicas interpessoais do trabalho, questões hierárquicas e clareza de papéis, bem como os relacionamentos dentro do âmbito laboral. Esse grupo é complementado com as devolutivas feitas na questão aberta ao final da pesquisa.', ordem = 2
    WHERE id_categoria = v_cat;
  END IF;

  UPDATE qps_perguntas SET id_categoria = v_cat, ordem = 1
  WHERE texto = 'A organização da empresa está clara para você?'
    AND id_categoria IN (SELECT id_categoria FROM qps_categorias WHERE id_tipo = v_tipo);
  IF NOT FOUND THEN RAISE EXCEPTION 'pergunta nao encontrada: %', 'A organização da empresa está clara para você?'; END IF;
  UPDATE qps_perguntas SET id_categoria = v_cat, ordem = 2
  WHERE texto = 'O trabalho em equipe funciona bem?'
    AND id_categoria IN (SELECT id_categoria FROM qps_categorias WHERE id_tipo = v_tipo);
  IF NOT FOUND THEN RAISE EXCEPTION 'pergunta nao encontrada: %', 'O trabalho em equipe funciona bem?'; END IF;
  UPDATE qps_perguntas SET id_categoria = v_cat, ordem = 3
  WHERE texto = 'A empresa promove reuniões para alinhar o trabalho?'
    AND id_categoria IN (SELECT id_categoria FROM qps_categorias WHERE id_tipo = v_tipo);
  IF NOT FOUND THEN RAISE EXCEPTION 'pergunta nao encontrada: %', 'A empresa promove reuniões para alinhar o trabalho?'; END IF;

  -- ── Grupo 3: Complexidade laboral (4 perguntas)
  SELECT id_categoria INTO v_cat FROM qps_categorias
  WHERE id_tipo = v_tipo AND nome = 'Complexidade laboral';
  IF v_cat IS NULL THEN
    INSERT INTO qps_categorias (id_tipo, nome, descricao, ordem)
    VALUES (v_tipo, 'Complexidade laboral', 'Aspectos avaliados: Dentro desse grupo se avaliam a intercessão trabalho - trabalho, buscando a percepção do funcionário sobre as atividades que são desempenhadas por ele ao longo da jornada de trabalho, passando por questões', 3)
    RETURNING id_categoria INTO v_cat;
  ELSE
    UPDATE qps_categorias SET descricao = 'Aspectos avaliados: Dentro desse grupo se avaliam a intercessão trabalho - trabalho, buscando a percepção do funcionário sobre as atividades que são desempenhadas por ele ao longo da jornada de trabalho, passando por questões', ordem = 3
    WHERE id_categoria = v_cat;
  END IF;

  UPDATE qps_perguntas SET id_categoria = v_cat, ordem = 1
  WHERE texto = 'Seu trabalho exige muita atenção e concentração?'
    AND id_categoria IN (SELECT id_categoria FROM qps_categorias WHERE id_tipo = v_tipo);
  IF NOT FOUND THEN RAISE EXCEPTION 'pergunta nao encontrada: %', 'Seu trabalho exige muita atenção e concentração?'; END IF;
  UPDATE qps_perguntas SET id_categoria = v_cat, ordem = 2
  WHERE texto = 'O seu trabalho tem tarefas variadas ou é mais repetitivo?'
    AND id_categoria IN (SELECT id_categoria FROM qps_categorias WHERE id_tipo = v_tipo);
  IF NOT FOUND THEN RAISE EXCEPTION 'pergunta nao encontrada: %', 'O seu trabalho tem tarefas variadas ou é mais repetitivo?'; END IF;
  UPDATE qps_perguntas SET id_categoria = v_cat, ordem = 3
  WHERE texto = 'No seu trabalho, há situações que exigem calma e controle emocional?'
    AND id_categoria IN (SELECT id_categoria FROM qps_categorias WHERE id_tipo = v_tipo);
  IF NOT FOUND THEN RAISE EXCEPTION 'pergunta nao encontrada: %', 'No seu trabalho, há situações que exigem calma e controle emocional?'; END IF;
  UPDATE qps_perguntas SET id_categoria = v_cat, ordem = 4
  WHERE texto = 'Seu trabalho pode ser feito de casa (home office) ou precisa estar na empresa?'
    AND id_categoria IN (SELECT id_categoria FROM qps_categorias WHERE id_tipo = v_tipo);
  IF NOT FOUND THEN RAISE EXCEPTION 'pergunta nao encontrada: %', 'Seu trabalho pode ser feito de casa (home office) ou precisa estar na empresa?'; END IF;

  -- ── Grupo 4: Impactos de alto risco (4 perguntas)
  SELECT id_categoria INTO v_cat FROM qps_categorias
  WHERE id_tipo = v_tipo AND nome = 'Impactos de alto risco';
  IF v_cat IS NULL THEN
    INSERT INTO qps_categorias (id_tipo, nome, descricao, ordem)
    VALUES (v_tipo, 'Impactos de alto risco', 'Aspectos avaliados: interação do funcionário com a segurança do ambiente laboral', 4)
    RETURNING id_categoria INTO v_cat;
  ELSE
    UPDATE qps_categorias SET descricao = 'Aspectos avaliados: interação do funcionário com a segurança do ambiente laboral', ordem = 4
    WHERE id_categoria = v_cat;
  END IF;

  UPDATE qps_perguntas SET id_categoria = v_cat, ordem = 1
  WHERE texto = 'O seu trabalho envolve algum tipo de cuidado extra com segurança?'
    AND id_categoria IN (SELECT id_categoria FROM qps_categorias WHERE id_tipo = v_tipo);
  IF NOT FOUND THEN RAISE EXCEPTION 'pergunta nao encontrada: %', 'O seu trabalho envolve algum tipo de cuidado extra com segurança?'; END IF;
  UPDATE qps_perguntas SET id_categoria = v_cat, ordem = 2
  WHERE texto = 'Você trabalha com produtos ou atividades que exigem atenção à saúde e segurança?'
    AND id_categoria IN (SELECT id_categoria FROM qps_categorias WHERE id_tipo = v_tipo);
  IF NOT FOUND THEN RAISE EXCEPTION 'pergunta nao encontrada: %', 'Você trabalha com produtos ou atividades que exigem atenção à saúde e segurança?'; END IF;
  UPDATE qps_perguntas SET id_categoria = v_cat, ordem = 3
  WHERE texto = 'Você já soube de algum incidente ou acidente de trabalho na empresa?'
    AND id_categoria IN (SELECT id_categoria FROM qps_categorias WHERE id_tipo = v_tipo);
  IF NOT FOUND THEN RAISE EXCEPTION 'pergunta nao encontrada: %', 'Você já soube de algum incidente ou acidente de trabalho na empresa?'; END IF;
  UPDATE qps_perguntas SET id_categoria = v_cat, ordem = 4
  WHERE texto = 'Você recebeu treinamento para fazer seu trabalho com segurança?'
    AND id_categoria IN (SELECT id_categoria FROM qps_categorias WHERE id_tipo = v_tipo);
  IF NOT FOUND THEN RAISE EXCEPTION 'pergunta nao encontrada: %', 'Você recebeu treinamento para fazer seu trabalho com segurança?'; END IF;

  -- ── Grupo 5: Sem grupo definido — aguardando a Sarah (2 perguntas)
  SELECT id_categoria INTO v_cat FROM qps_categorias
  WHERE id_tipo = v_tipo AND nome = 'Sem grupo definido — aguardando a Sarah';
  IF v_cat IS NULL THEN
    INSERT INTO qps_categorias (id_tipo, nome, descricao, ordem)
    VALUES (v_tipo, 'Sem grupo definido — aguardando a Sarah', 'Estas duas perguntas existem no formulário, mas não aparecem no documento da métrica ("MÉTRICA PER - PAINEL"). Ficam aqui, na ordem em que saem do formulário, até a Sarah dizer a qual grupo elas pertencem. Não é um grupo de risco — é um lugar de espera, de propósito visível.', 5)
    RETURNING id_categoria INTO v_cat;
  ELSE
    UPDATE qps_categorias SET descricao = 'Estas duas perguntas existem no formulário, mas não aparecem no documento da métrica ("MÉTRICA PER - PAINEL"). Ficam aqui, na ordem em que saem do formulário, até a Sarah dizer a qual grupo elas pertencem. Não é um grupo de risco — é um lugar de espera, de propósito visível.', ordem = 5
    WHERE id_categoria = v_cat;
  END IF;

  UPDATE qps_perguntas SET id_categoria = v_cat, ordem = 1
  WHERE texto = 'Como você avalia sua saúde (física e mental)?'
    AND id_categoria IN (SELECT id_categoria FROM qps_categorias WHERE id_tipo = v_tipo);
  IF NOT FOUND THEN RAISE EXCEPTION 'pergunta nao encontrada: %', 'Como você avalia sua saúde (física e mental)?'; END IF;
  UPDATE qps_perguntas SET id_categoria = v_cat, ordem = 2
  WHERE texto = 'Você considera que as demandas do trabalho são bem distribuídas?'
    AND id_categoria IN (SELECT id_categoria FROM qps_categorias WHERE id_tipo = v_tipo);
  IF NOT FOUND THEN RAISE EXCEPTION 'pergunta nao encontrada: %', 'Você considera que as demandas do trabalho são bem distribuídas?'; END IF;

  -- ── A pergunta 17 volta à ordem do documento da Sarah
  UPDATE qps_perguntas
  SET opcoes = to_jsonb(ARRAY['Sim, exige muito cuidado', 'Exige um pouco de atenção', 'Algumas atividades têm riscos', 'Pouco risco', 'Nenhum risco identificado']::text[])
  WHERE texto = 'Você trabalha com produtos ou atividades que exigem atenção à saúde e segurança?'
    AND id_categoria IN (SELECT id_categoria FROM qps_categorias WHERE id_tipo = v_tipo);
  IF NOT FOUND THEN RAISE EXCEPTION 'pergunta 17 nao encontrada'; END IF;

  -- ── Some com as categorias que eu tinha inventado e que ficaram vazias
  DELETE FROM qps_categorias c
  WHERE c.id_tipo = v_tipo
    AND NOT EXISTS (SELECT 1 FROM qps_perguntas p WHERE p.id_categoria = c.id_categoria);

  -- ── Conferências que fazem a migration abortar em vez de estragar em silêncio
  SELECT count(*) INTO v_orfas FROM qps_perguntas p
  JOIN qps_categorias c ON c.id_categoria = p.id_categoria
  WHERE c.id_tipo = v_tipo;
  IF v_orfas <> 20 THEN
    RAISE EXCEPTION 'esperava 20 perguntas no PER, encontrei %', v_orfas;
  END IF;

  -- A sequência achatada tem de ser a ordem das colunas do formulário.
  SELECT string_agg(x.texto, ' | ' ORDER BY x.co, x.po) INTO v_seq
  FROM (SELECT left(p.texto, 18) AS texto, c.ordem AS co, p.ordem AS po
        FROM qps_perguntas p JOIN qps_categorias c ON c.id_categoria = p.id_categoria
        WHERE c.id_tipo = v_tipo) x;
  IF v_seq NOT LIKE 'A temperatura do %' THEN
    RAISE EXCEPTION 'a ordem achatada nao comeca pela temperatura: %', left(v_seq, 60);
  END IF;
  IF v_seq NOT LIKE '%Você considera q' || '%' THEN
    RAISE EXCEPTION 'a ordem achatada nao termina na distribuicao de demandas';
  END IF;

  RAISE NOTICE 'PER reagrupado: % grupos, % perguntas',
    (SELECT count(*) FROM qps_categorias WHERE id_tipo = v_tipo), v_orfas;
END
$m$;