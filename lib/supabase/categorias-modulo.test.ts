import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { CATEGORIAS_MODULO, TODOS_MODULOS } from "./types";

describe("CATEGORIAS_MODULO", () => {
  test("cobre cada módulo exatamente uma vez", () => {
    const todos = CATEGORIAS_MODULO.flatMap((c) => c.modulos);
    assert.equal(new Set(todos).size, todos.length);
    assert.deepEqual([...todos].sort(), [...TODOS_MODULOS].sort());
  });
});
