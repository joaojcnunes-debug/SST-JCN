import { test } from "node:test";
import assert from "node:assert/strict";
import { emailsDaLista, pessoasDaLista } from "./pessoas-da-lista";

const U = [{ email: "ana@x.com" }, { email: "Bia@x.com" }, { email: "caio@x.com" }, { email: "eu@x.com" }];

test("só quem é da lista, mais o já escolhido e eu", () => {
  const lista = emailsDaLista([{ email: "ANA@x.com" }], "QDR-1", false);
  assert.deepEqual(pessoasDaLista(U, lista, ["bia@x.com"], "eu@x.com").map((u) => u.email), ["ana@x.com", "Bia@x.com", "eu@x.com"]);
});

test("sem equipe cadastrada, sem quadro, carregando ou com erro: todos (não trava a tela)", () => {
  assert.equal(emailsDaLista([], "QDR-1", false), null);
  assert.equal(emailsDaLista(undefined, "QDR-1", false), null);
  assert.equal(emailsDaLista([{ email: "a@x.com" }], null, false), null);
  assert.equal(emailsDaLista([{ email: "a@x.com" }], "QDR-1", true), null);
  assert.equal(pessoasDaLista(U, null).length, U.length);
});

test("conjunto vazio (já resolvido): só eu e o já escolhido", () => {
  assert.deepEqual(pessoasDaLista(U, new Set(), [null, "caio@x.com"], null).map((u) => u.email), ["caio@x.com"]);
});
