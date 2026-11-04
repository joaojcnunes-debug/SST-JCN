import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { opcoesDoCatalogo } from "./catalogo-opcoes";

const BASE = ["Estresse", "Ansiedade"];

describe("opcoesDoCatalogo (0.3.231)", () => {
  test("sem catálogo carregado ou sem nenhuma linha usa a base", () => {
    assert.deepEqual(opcoesDoCatalogo(undefined, BASE), BASE);
    assert.deepEqual(opcoesDoCatalogo(null, BASE), BASE);
    assert.deepEqual(opcoesDoCatalogo([], BASE), BASE);
  });

  test("com linhas, só as ativas, na ordem recebida", () => {
    const linhas = [
      { titulo: "B", ativo: true },
      { titulo: "A", ativo: false },
      { titulo: "C", ativo: true },
    ];
    assert.deepEqual(opcoesDoCatalogo(linhas, BASE), ["B", "C"]);
  });

  test("todas desativadas dá lista vazia, não a base", () => {
    const linhas = [
      { titulo: "A", ativo: false },
      { titulo: "B", ativo: false },
    ];
    assert.deepEqual(opcoesDoCatalogo(linhas, BASE), []);
  });

  test("não devolve a própria base (cópia)", () => {
    const r = opcoesDoCatalogo([], BASE);
    assert.notEqual(r, BASE);
  });
});
