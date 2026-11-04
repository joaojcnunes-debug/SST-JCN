import { test } from "node:test";
import assert from "node:assert/strict";
import { opcoesDaLista } from "./listas";

const PADRAO = ["Ar", "Contato"];

test("a lista configurada vale no lugar da fixa", () => {
  assert.deepEqual(opcoesDaLista(["Ruído aéreo", " Água "], PADRAO), ["Ruído aéreo", "Água"]);
});

test("lista configurada vazia (ou só espaços) cai na fixa", () => {
  assert.deepEqual(opcoesDaLista([], PADRAO), PADRAO);
  assert.deepEqual(opcoesDaLista(["  "], PADRAO), PADRAO);
  assert.deepEqual(opcoesDaLista(undefined, PADRAO), PADRAO);
});

test("o valor já gravado no risco continua como opção", () => {
  assert.deepEqual(opcoesDaLista(["Ar"], PADRAO, "Antigo"), ["Ar", "Antigo"]);
  assert.deepEqual(opcoesDaLista(["Ar"], PADRAO, ["Ar", "Velho", ""]), ["Ar", "Velho"]);
  assert.deepEqual(opcoesDaLista(["Ar"], PADRAO, ""), ["Ar"]);
});
