import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { nomesResponsaveis, temResponsavel } from "./responsaveis";

describe("responsáveis espelhados", () => {
  test("separa por vírgula e tira espaços", () => {
    assert.deepEqual(nomesResponsaveis("Ana Souza, João Lima"), ["Ana Souza", "João Lima"]);
    assert.deepEqual(nomesResponsaveis("Ana Souza"), ["Ana Souza"]);
    assert.deepEqual(nomesResponsaveis(null), []);
    assert.deepEqual(nomesResponsaveis("  "), []);
  });
  test("temResponsavel compara o nome inteiro", () => {
    assert.equal(temResponsavel("Ana Souza, João Lima", "João Lima"), true);
    assert.equal(temResponsavel("Ana Souza, João Lima", "João"), false);
    assert.equal(temResponsavel("Ana Souza", ""), false);
    assert.equal(temResponsavel(null, "Ana Souza"), false);
  });
});
