import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  calcularMatriz,
  faixaPergunta,
  normalizarResposta,
  scoreToProbabilidade,
} from "./matriz";
import type { QpsCategoria, QpsPergunta } from "@/lib/supabase/types";

/**
 * Testes da régua do QPS — a conta que decide o nível de risco psicossocial de
 * um setor e vai parar no documento de SST.
 *
 * Existem por causa da v180, que trouxe alternativas próprias por pergunta. A
 * promessa dessa mudança é dupla e vale a pena travar:
 *
 * 1. QUESTIONÁRIO NOVO: a primeira alternativa é o pior cenário e a última é o
 *    melhor, em qualquer pergunta, tendo ela 3 ou 7 alternativas.
 * 2. QUESTIONÁRIOS ANTIGOS: nada muda. Os 5 tipos e ~490 respondentes já
 *    gravados têm que sair com exatamente o mesmo score de antes.
 *
 * A (2) é a que dá medo: é regressão silenciosa em documento já emitido. Por
 * isso ela é testada com a escala 0–4 real do Forms da JCN Consultoria.
 */

const CAT: QpsCategoria = {
  id_categoria: "cat-1",
  id_tipo: "tipo-1",
  nome: "Demanda de Trabalho",
  descricao: null,
  ordem: 1,
};

function pergunta(over: Partial<QpsPergunta> & { id_pergunta: string }): QpsPergunta {
  return {
    id_categoria: "cat-1",
    texto: "pergunta",
    logica: "invertida",
    ordem: 1,
    ativo: true,
    ...over,
  };
}

/** Score da única célula da matriz para um conjunto de respostas. */
function scoreDe(
  perguntas: QpsPergunta[],
  respostas: Record<string, number>,
  escalaMin = 1,
  escalaMax = 5,
): number {
  const cells = calcularMatriz(
    ["Producao"],
    [CAT],
    perguntas,
    [{ setor: "Producao", respostas }],
    [],
    escalaMin,
    escalaMax,
  );
  return cells[0].scorePerc;
}

describe("faixa da pergunta (v180)", () => {
  test("com alternativas próprias, a faixa é 1..N", () => {
    assert.deepEqual(faixaPergunta({ opcoes: ["a", "b", "c"] }, 1, 5), { min: 1, max: 3 });
    assert.deepEqual(faixaPergunta({ opcoes: ["a", "b"] }, 0, 4), { min: 1, max: 2 });
  });

  test("sem alternativas, vale a escala do tipo — comportamento de antes da v180", () => {
    assert.deepEqual(faixaPergunta({}, 1, 5), { min: 1, max: 5 });
    assert.deepEqual(faixaPergunta({ opcoes: null }, 0, 4), { min: 0, max: 4 });
  });

  test("lista de 1 alternativa NÃO vira faixa 1..1", () => {
    // 1..1 daria (v−min)/(max−min) = divisão por zero → NaN silencioso no score.
    // O CHECK da v180 impede que isso chegue ao banco; aqui é o cinto de baixo.
    assert.deepEqual(faixaPergunta({ opcoes: ["única"] }, 1, 5), { min: 1, max: 5 });
  });
});

describe("a primeira alternativa é o pior cenário", () => {
  test("posição 1 sai 100% de risco e a última 0%, com 3 alternativas", () => {
    const p = [pergunta({ id_pergunta: "p1", opcoes: ["Nunca", "Às vezes", "Sempre"] })];
    assert.equal(scoreDe(p, { p1: 1 }), 100);
    assert.equal(scoreDe(p, { p1: 2 }), 50);
    assert.equal(scoreDe(p, { p1: 3 }), 0);
  });

  test("o mesmo com 7 alternativas — o tamanho da lista não muda o extremo", () => {
    const opcoes = ["1", "2", "3", "4", "5", "6", "7"];
    const p = [pergunta({ id_pergunta: "p1", opcoes })];
    assert.equal(scoreDe(p, { p1: 1 }), 100);
    assert.equal(scoreDe(p, { p1: 7 }), 0);
  });

  test("perguntas de tamanhos diferentes pesam igual na média", () => {
    // É o coração do briefing: a pior resposta de uma pergunta de 3 opções tem
    // que valer o mesmo que a pior de uma de 5, sem peso inventado.
    const perguntas = [
      pergunta({ id_pergunta: "p1", opcoes: ["a", "b", "c"] }),
      pergunta({ id_pergunta: "p2", ordem: 2, opcoes: ["a", "b", "c", "d", "e"] }),
    ];
    assert.equal(scoreDe(perguntas, { p1: 1, p2: 1 }), 100, "as duas na pior");
    assert.equal(scoreDe(perguntas, { p1: 3, p2: 5 }), 0, "as duas na melhor");
    assert.equal(scoreDe(perguntas, { p1: 1, p2: 5 }), 50, "uma na pior, outra na melhor");
  });

  test("`direta` inverte o sentido — para a pergunta em que a primeira é a boa", () => {
    const p = [
      pergunta({ id_pergunta: "p1", logica: "direta", opcoes: ["Ótimo", "Regular", "Péssimo"] }),
    ];
    assert.equal(scoreDe(p, { p1: 1 }), 0);
    assert.equal(scoreDe(p, { p1: 3 }), 100);
  });

  test("a pior resposta chega em ALTO na ponta da régua", () => {
    // Não basta o score: o que vai para o documento é o nível.
    assert.equal(scoreToProbabilidade(100), 3);
    assert.equal(scoreToProbabilidade(0), 1);
  });
});

describe("questionários antigos não mudam de score", () => {
  test("escala 0–4 do Forms da JCN Consultoria continua idêntica", () => {
    const p = [pergunta({ id_pergunta: "p1" })]; // sem opcoes
    assert.equal(scoreDe(p, { p1: 0 }, 0, 4), 100);
    assert.equal(scoreDe(p, { p1: 2 }, 0, 4), 50);
    assert.equal(scoreDe(p, { p1: 4 }, 0, 4), 0);
  });

  test("escala 1–5 continua idêntica, direta e invertida", () => {
    const inv = [pergunta({ id_pergunta: "p1" })];
    assert.equal(scoreDe(inv, { p1: 1 }), 100);
    assert.equal(scoreDe(inv, { p1: 5 }), 0);

    const dir = [pergunta({ id_pergunta: "p1", logica: "direta" })];
    assert.equal(scoreDe(dir, { p1: 1 }), 0);
    assert.equal(scoreDe(dir, { p1: 5 }), 100);
  });

  test("a conta antiga bate valor a valor com a fórmula de referência", () => {
    for (const valor of [1, 2, 3, 4, 5]) {
      assert.equal(
        normalizarResposta(valor, "invertida", 1, 5),
        ((5 + 1 - valor - 1) / 4) * 100,
      );
    }
  });
});

describe("misturar pergunta nova e antiga no mesmo tipo", () => {
  test("cada uma usa a sua faixa, na mesma média", () => {
    // Cenário real de quem acrescenta uma pergunta com alternativas a um tipo
    // que já existia: a antiga tem que continuar lendo a escala do tipo.
    const perguntas = [
      pergunta({ id_pergunta: "antiga" }), // escala do tipo, 1–5
      pergunta({ id_pergunta: "nova", ordem: 2, opcoes: ["ruim", "médio", "bom"] }),
    ];
    assert.equal(scoreDe(perguntas, { antiga: 1, nova: 1 }), 100);
    assert.equal(scoreDe(perguntas, { antiga: 5, nova: 3 }), 0);
    assert.equal(scoreDe(perguntas, { antiga: 3, nova: 2 }), 50);
  });
});

describe("resposta ausente", () => {
  test("pergunta não respondida não entra na média (não conta como pior)", () => {
    const perguntas = [
      pergunta({ id_pergunta: "p1", opcoes: ["a", "b", "c"] }),
      pergunta({ id_pergunta: "p2", ordem: 2, opcoes: ["a", "b", "c"] }),
    ];
    assert.equal(scoreDe(perguntas, { p1: 3 }), 0, "só a melhor respondida");
    assert.equal(scoreDe(perguntas, { p1: 1 }), 100, "só a pior respondida");
  });

  test("nenhuma resposta marca a célula como sem base", () => {
    const cells = calcularMatriz(
      ["Producao"],
      [CAT],
      [pergunta({ id_pergunta: "p1", opcoes: ["a", "b"] })],
      [{ setor: "Producao", respostas: {} }],
      [],
      1,
      5,
    );
    assert.equal(cells[0].semBase, true);
  });
});
