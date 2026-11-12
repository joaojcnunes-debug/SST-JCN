import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ordenarPorNome } from "./ordem-alfabetica";

const nomes = (l: { nome: string }[]) => l.map((x) => x.nome);

describe("ordenarPorNome", () => {
  test("as listas da pasta Chabra em ordem alfabética do português", () => {
    const listas = ["Geral", "Teresópolis", "Friburgo", "Guapimirim", "Comercial", "Campos", "Piabetá", "Petrópolis", "Suporte T.I",
      "Cipa / Designado", "Cremerj", "Agenda", "Designado da Cipa", "eSocial", "Pós Venda", "SST", "Agenda · Campos"].map((nome) => ({ nome }));
    assert.deepEqual(nomes(ordenarPorNome(listas)), [
      "Agenda", "Agenda · Campos", "Campos", "Cipa / Designado", "Comercial", "Cremerj", "Designado da Cipa", "eSocial", "Friburgo",
      "Geral", "Guapimirim", "Petrópolis", "Piabetá", "Pós Venda", "SST", "Suporte T.I", "Teresópolis",
    ]);
  });
  test("números na ordem natural, espaço sobrando não conta, nome igual mantém a ordem e a lista original não muda", () => {
    const l = [{ nome: "Lista 10" }, { nome: " Lista 2" }, { nome: "lista 1", k: "a" }, { nome: "Lista 1", k: "b" }];
    const r = ordenarPorNome(l);
    assert.deepEqual(nomes(r), ["lista 1", "Lista 1", " Lista 2", "Lista 10"]);
    assert.deepEqual(r.slice(0, 2).map((x) => (x as { k?: string }).k), ["a", "b"]);
    assert.equal(l[0].nome, "Lista 10");
  });
});
