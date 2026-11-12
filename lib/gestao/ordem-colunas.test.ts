import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { moverColuna, ordensMudadas } from "./ordem-colunas";

describe("moverColuna", () => {
  const cols = ["A", "B", "C", "D"];
  test("antes e depois do alvo, para a esquerda e para a direita", () => {
    assert.deepEqual(moverColuna(cols, "D", "B", false), ["A", "D", "B", "C"]);
    assert.deepEqual(moverColuna(cols, "D", "B", true), ["A", "B", "D", "C"]);
    assert.deepEqual(moverColuna(cols, "A", "C", true), ["B", "C", "A", "D"]);
    assert.deepEqual(moverColuna(cols, "A", "D", true), ["B", "C", "D", "A"]);
    assert.deepEqual(moverColuna(cols, "C", "A", false), ["C", "A", "B", "D"]);
  });
  test("soltar no mesmo lugar ou fora das colunas não muda nada", () => {
    assert.equal(moverColuna(cols, "B", "B", true), cols);
    assert.equal(moverColuna(cols, "B", "C", false), cols);
    assert.equal(moverColuna(cols, "B", "A", true), cols);
    assert.equal(moverColuna(cols, "X", "A", false), cols);
    assert.equal(moverColuna(cols, "A", "X", false), cols);
  });
});

describe("ordensMudadas", () => {
  test("grava só quem mudou de posição, com a ordem da tela", () => {
    const colunas = [
      { id: "1", slug: "A", ordem: 0 }, { id: "2", slug: "B", ordem: 1 },
      { id: "3", slug: "C", ordem: 2 }, { id: "4", slug: "D", ordem: 3 },
    ];
    assert.deepEqual(ordensMudadas(colunas, ["A", "D", "B", "C"]), [{ id: "4", ordem: 1 }, { id: "2", ordem: 2 }, { id: "3", ordem: 3 }]);
    assert.deepEqual(ordensMudadas(colunas, ["A", "B", "C", "D"]), []);
  });
  test("ordens antigas com buracos ou repetidas viram 0, 1, 2…", () => {
    const colunas = [{ id: "1", slug: "A", ordem: 5 }, { id: "2", slug: "B", ordem: 5 }, { id: "3", slug: "C", ordem: 9 }];
    assert.deepEqual(ordensMudadas(colunas, ["A", "B", "C"]), [{ id: "1", ordem: 0 }, { id: "2", ordem: 1 }, { id: "3", ordem: 2 }]);
  });
});
