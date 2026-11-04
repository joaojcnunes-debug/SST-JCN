import { test } from "node:test";
import assert from "node:assert/strict";
import { paresRenomeados } from "./renomear";

test("renomear uma linha gera o par de/para", () => {
  assert.deepEqual(paresRenomeados(["Raro", "Comum"], ["Remoto", "Comum"]), {
    pares: [{ de: "Raro", para: "Remoto" }],
    conflito: false,
  });
});

test("linha nova e linha sem mudança não geram par", () => {
  assert.deepEqual(paresRenomeados(["A", null], ["A", "Nova"]).pares, []);
  assert.deepEqual(paresRenomeados(["A"], [" A "]).pares, []);
});

test("troca entre linhas ou juntar com nome existente é conflito", () => {
  assert.deepEqual(paresRenomeados(["A", "B"], ["B", "A"]), { pares: [], conflito: true });
  assert.deepEqual(paresRenomeados(["A", "B"], ["B", "B"]), { pares: [], conflito: true });
});

test("linha removida não entra (a lista de originais acompanha a remoção)", () => {
  assert.deepEqual(paresRenomeados(["A", "C"], ["A", "Cê"]).pares, [{ de: "C", para: "Cê" }]);
});
