import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mencionados, partesComMencoes, mencaoEmDigitacao, sugestoesMencao, inserirMencao, type PessoaMencao } from "./mencoes";

// Nomes reais do painel (12/11/2026): 3 Anas e 4 João/Joao — primeiro nome ambíguo.
const P: PessoaMencao[] = [
  { nome: "Ana Beatriz Bento", email: "ana.beatriz@chabra.com.br" },
  { nome: "Ana Clara", email: "ana.clara@chabra.com.br" },
  { nome: "Ana Renata", email: "ana.renata@chabra.com.br" },
  { nome: "Emilia dos Reis", email: "emilia.reis@chabra.com.br" },
  { nome: "Joao Marcos Silveira", email: "joao.silveira@chabra.com.br" },
  { nome: "João Jefferson", email: "joao.jefferson@chabra.com.br" },
  { nome: "Suporte T.I", email: "suporte.ti@chabra.com.br" },
];

describe("mencionados (mesma regra da gestao_mencionados, v368)", () => {
  test("nome completo, primeiro nome único e sem acento", () => {
    assert.deepEqual(mencionados("@Emilia dos Reis veja isso", P), ["emilia.reis@chabra.com.br"]);
    assert.deepEqual(mencionados("oi @emilia, tudo bem?", P), ["emilia.reis@chabra.com.br"]);
    assert.deepEqual(mencionados("@Emília veja", P), ["emilia.reis@chabra.com.br"]);
    assert.deepEqual(mencionados("(@emilia)", P), ["emilia.reis@chabra.com.br"]);
  });
  test("primeiro nome repetido não avisa ninguém; o nome completo avisa só a pessoa", () => {
    assert.deepEqual(mencionados("@Ana pode ver?", P), []);
    assert.deepEqual(mencionados("@João olha", P), []);
    assert.deepEqual(mencionados("@Ana Renata pode ver?", P), ["ana.renata@chabra.com.br"]);
    assert.deepEqual(mencionados("@joão jefferson", P), ["joao.jefferson@chabra.com.br"]);
  });
  test("não casa palavra maior, e-mail no texto nem texto sem @", () => {
    assert.deepEqual(mencionados("@emiliana", P), []);
    assert.deepEqual(mencionados("mande para emilia@chabra.com.br", P), []);
    assert.deepEqual(mencionados("Emilia dos Reis", P), []);
  });
  test("ponto no nome é literal; várias pessoas", () => {
    assert.deepEqual(mencionados("@Suporte T.I por favor", P), ["suporte.ti@chabra.com.br"]);
    assert.deepEqual(mencionados("@Emilia dos Reis e @Ana Renata, vejam", P), ["ana.renata@chabra.com.br", "emilia.reis@chabra.com.br"]);
  });
});

describe("partesComMencoes", () => {
  test("destaca o trecho do texto original, o nome mais longo ganha", () => {
    const partes = partesComMencoes("Oi @Emília dos Reis, veja com @Ana Renata.", P);
    assert.deepEqual(partes.map((p) => [p.texto, p.pessoa?.email ?? null]), [
      ["Oi ", null],
      ["@Emília dos Reis", "emilia.reis@chabra.com.br"],
      [", veja com ", null],
      ["@Ana Renata", "ana.renata@chabra.com.br"],
      [".", null],
    ]);
  });
  test("sem menção: o texto inteiro", () => {
    assert.deepEqual(partesComMencoes("nada aqui", P), [{ texto: "nada aqui" }]);
    assert.deepEqual(partesComMencoes("", P), [{ texto: "" }]);
  });
});

describe("digitação do @", () => {
  test("acha o @ antes do cursor, inclusive com espaço no nome", () => {
    assert.deepEqual(mencaoEmDigitacao("oi @emi", 7), { inicio: 3, termo: "emi" });
    assert.deepEqual(mencaoEmDigitacao("@", 1), { inicio: 0, termo: "" });
    assert.deepEqual(mencaoEmDigitacao("oi @Emilia do", 13), { inicio: 3, termo: "Emilia do" });
  });
  test("e-mail, espaço logo após o @ ou dois espaços fecham", () => {
    assert.equal(mencaoEmDigitacao("fulano@chabra", 13), null);
    assert.equal(mencaoEmDigitacao("oi @ ", 5), null);
    assert.equal(mencaoEmDigitacao("oi @Ana  x", 10), null);
    assert.equal(mencaoEmDigitacao("sem arroba", 10), null);
  });
  test("sugestões: começo do nome antes de começo de palavra, sem acento", () => {
    assert.deepEqual(sugestoesMencao("ana", P).map((p) => p.nome), ["Ana Beatriz Bento", "Ana Clara", "Ana Renata"]);
    assert.deepEqual(sugestoesMencao("re", P).map((p) => p.nome), ["Ana Renata", "Emilia dos Reis"]);
    assert.deepEqual(sugestoesMencao("joao j", P).map((p) => p.nome), ["João Jefferson"]);
    assert.equal(sugestoesMencao("", P, 3).length, 3);
  });
  test("inserir troca o termo pelo nome completo e põe o cursor depois", () => {
    assert.deepEqual(inserirMencao("oi @emi", 3, 7, "Emilia dos Reis"), { texto: "oi @Emilia dos Reis ", cursor: 20 });
    assert.deepEqual(inserirMencao("oi @emi veja", 3, 7, "Emilia dos Reis"), { texto: "oi @Emilia dos Reis veja", cursor: 19 });
  });
});
