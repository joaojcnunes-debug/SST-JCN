-- v180 — QPS: alternativas próprias por pergunta (escala ordinal)
--
-- Até aqui a escala do QPS morava no TIPO (`qps_tipos.escala_min/max`) e valia
-- igual para todas as perguntas dele: o respondente sempre marcava um número
-- dentro da mesma faixa. O questionário novo não é assim — cada pergunta tem as
-- suas próprias alternativas, em quantidade diferente (uma com 3, outra com 5),
-- e não há número nenhum no formulário. O que existe é ORDEM: a primeira
-- alternativa é o pior cenário e a última é o melhor.
--
-- A ordem é o número. Uma pergunta com 3 alternativas vale 1..3, com 5 vale
-- 1..5, e `normalizarResposta` já converte qualquer faixa para 0–100% — é isso
-- que deixa perguntas de tamanhos diferentes serem comparadas sem inventar peso.
-- O sentido (primeira = pior) continua sendo a coluna `logica` que já existe:
-- "invertida" já significa exatamente "valor menor é o pior".
--
-- ADITIVA E REVERSÍVEL. A coluna nasce NULL e pergunta sem alternativas
-- continua lendo a escala do tipo, do jeito de sempre. Nenhum dos 5 tipos, 71
-- perguntas e ~490 respondentes já gravados muda de comportamento, e nada
-- precisa ser reimportado. Rollback em scripts/sql/.

ALTER TABLE qps_perguntas
  ADD COLUMN IF NOT EXISTS opcoes jsonb;

COMMENT ON COLUMN qps_perguntas.opcoes IS
  'Alternativas próprias desta pergunta, como array JSON de textos NA ORDEM do '
  'formulário: ["pior cenário", ..., "melhor cenário"]. A POSIÇÃO é o valor '
  'gravado em qps_respondentes.respostas (1 = primeira alternativa). O sentido '
  'vem de `logica`: "invertida" = a primeira é a pior (padrão do questionário '
  'ordinal); "direta" = a primeira é a melhor. NULL = a pergunta usa a escala '
  'numérica do tipo (qps_tipos.escala_min/escala_max), comportamento anterior à '
  'v180. Mínimo de 2 alternativas quando preenchida.';

-- Guarda mínima: array de textos não vazios, com pelo menos 2 itens, ou NULL.
-- Sem o mínimo de 2, uma lista de 1 alternativa entraria e dividiria por zero na
-- normalização ((v-min)/(max-min) com max=min), devolvendo NaN silencioso no
-- score — erro que não aparece em lugar nenhum da tela.
--
-- A varredura dos elementos é `jsonb_path_exists`, e não um
-- `NOT EXISTS (SELECT ... jsonb_array_elements)`: CHECK não aceita subquery
-- ("cannot use subquery in check constraint"). O jsonpath é função imutável e
-- passa. Espaço em branco puro fica para a aplicação, que já dá trim.
ALTER TABLE qps_perguntas
  DROP CONSTRAINT IF EXISTS qps_perguntas_opcoes_check;

ALTER TABLE qps_perguntas
  ADD CONSTRAINT qps_perguntas_opcoes_check
  CHECK (
    opcoes IS NULL
    OR (
      jsonb_typeof(opcoes) = 'array'
      AND jsonb_array_length(opcoes) >= 2
      AND NOT jsonb_path_exists(opcoes, '$[*] ? (@.type() != "string" || @ == "")')
    )
  );
