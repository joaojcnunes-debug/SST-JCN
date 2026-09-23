import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { nomeCurto } from "./nomes";

describe("nome curto da grade, derivado da conta do painel", () => {
  test("sem empate e o primeiro nome", () => {
    assert.equal(nomeCurto("Julianna Ribeiro Campos"), "Julianna");
    assert.equal(nomeCurto("  Amanda   Souza  "), "Amanda");
  });

  test("empate desempata pela inicial do sobrenome", () => {
    // Duas Marias na equipe: sem isto a grade teria duas colunas "Maria" e
    // ninguem saberia qual delas esta em Teresopolis.
    assert.equal(nomeCurto("Maria Aparecida Lima", ["Maria"]), "Maria L.");
  });

  test("particula NAO vira inicial", () => {
    // "Ana de Souza" nao pode virar "Ana D." — "de" nao identifica ninguem.
    assert.equal(nomeCurto("Ana de Souza", ["Ana"]), "Ana S.");
    assert.equal(nomeCurto("Ana dos Santos", ["Ana"]), "Ana S.");
  });

  test("empate ate na inicial cai no sobrenome inteiro", () => {
    assert.equal(nomeCurto("Maria Lima", ["Maria", "Maria L."]), "Maria Lima");
  });

  test("um nome so, ja usado, devolve ele mesmo", () => {
    // Nao existe desempate possivel. Inventar "Thaynara 2" seria pior do que
    // deixar o empate visivel para quem cadastra.
    assert.equal(nomeCurto("Thaynara", ["Thaynara"]), "Thaynara");
  });

  test("comparacao de empate ignora caixa e espaco", () => {
    assert.equal(nomeCurto("Sarah Mendes", ["  sarah "]), "Sarah M.");
  });

  test("nome vazio devolve vazio, sem estourar", () => {
    assert.equal(nomeCurto(""), "");
    assert.equal(nomeCurto("   "), "");
  });
});
