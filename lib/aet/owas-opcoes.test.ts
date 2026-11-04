import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { valoresRepetidos } from "./owas-opcoes";

describe("valoresRepetidos", () => {
  test("sem repetição devolve vazio", () => {
    assert.deepEqual(valoresRepetidos([{ value: 1 }, { value: 2 }, { value: 3 }]), []);
    assert.deepEqual(valoresRepetidos([]), []);
  });

  test("acha o número repetido, uma vez só, mesmo que apareça três vezes", () => {
    assert.deepEqual(valoresRepetidos([{ value: 2 }, { value: 1 }, { value: 2 }, { value: 2 }]), [2]);
  });

  test("vários repetidos saem em ordem crescente", () => {
    assert.deepEqual(valoresRepetidos([{ value: 4 }, { value: 1 }, { value: 4 }, { value: 1 }]), [1, 4]);
  });
});
