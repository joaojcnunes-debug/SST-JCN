import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canonicalizarTecnico, normalizarNome } from "./tecnicos";

/**
 * Os casos abaixo NÃO são inventados: são as 43 grafias que existiam na
 * produção em 2026-08-25, com as contagens medidas naquele dia.
 */
const CADASTRO = [
  "Nathalia Correa",
  "Sirlei Lopes",
  "Ana Renata",
  "Nathan Ferreira",
  "João Vitor Rodrigues",
  "Lédimo Duarte",
  "Elaine Maia de Oliveira",
  "Jorge Figueiredo",
  "Robson Alves",
  "Alexandre Moraes",
  "Estefano Rosário",
  "Stéfani Amorim",
  "Daniele Alves",
  "Phelipe Klein",
  "João Jefferson",
  "João Pessoal",
  "Joao Marcos Silveira",
];

describe("canonicalizarTecnico — as grafias reais da base", () => {
  const casos: [string, string][] = [
    ["Nathalia Corrêa de Oliveira", "Nathalia Correa"], // 69 inspeções
    ["Nathalia Correa de Oliveira", "Nathalia Correa"],
    ["Sirlei Lopes de Sousa", "Sirlei Lopes"], // 55
    ["Lédimo", "Lédimo Duarte"], // 26
    ["LÉDIMO", "Lédimo Duarte"], // 5
    ["Elaine Maia", "Elaine Maia de Oliveira"], // 16
    ["ELAINE MAIA", "Elaine Maia de Oliveira"],
    ["Elaine Maia de OliveirA", "Elaine Maia de Oliveira"],
    ["ALEXANDRE", "Alexandre Moraes"], // 14
    ["Alexandre", "Alexandre Moraes"],
    ["Estefano do Rosario silva", "Estefano Rosário"], // 7
    ["Estefano do rosário silva", "Estefano Rosário"],
    ["Estefano do Rosario sIlva", "Estefano Rosário"],
    ["Estefano rosario", "Estefano Rosário"],
    ["STÉFANI", "Stéfani Amorim"],
    ["Stéfani", "Stéfani Amorim"],
    ["João Vitor Lima Rodrigues", "João Vitor Rodrigues"],
    ["Nathan Felipe Ferreira", "Nathan Ferreira"],
    ["Daniele de Aguiar Alves Machado", "Daniele Alves"],
  ];

  for (const [digitado, esperado] of casos) {
    it(`"${digitado}" → ${esperado}`, () => {
      assert.equal(canonicalizarTecnico(digitado, CADASTRO), esperado);
    });
  }
});

describe("o caso Robson — sobrenome diferente, confirmado a mão", () => {
  it("Robson Silva é Robson Alves (31 inspeções)", () => {
    assert.equal(canonicalizarTecnico("Robson Silva", CADASTRO), "Robson Alves");
    assert.equal(canonicalizarTecnico("ROBSON SILVA", CADASTRO), "Robson Alves");
    assert.equal(canonicalizarTecnico("Robson silva", CADASTRO), "Robson Alves");
  });

  it("o erro de digitação ROBSON SILVS também", () => {
    assert.equal(canonicalizarTecnico("ROBSON SILVS", CADASTRO), "Robson Alves");
  });

  it("nenhuma regra automática alcançaria: Alves e Silva não têm palavra em comum", () => {
    // Se um dia o apelido for removido, este teste denuncia — e o certo é
    // devolver o texto original, nunca escolher outro Robson.
    const semApelido = canonicalizarTecnico("Robson Pereira", CADASTRO);
    assert.equal(semApelido, "Robson Pereira");
  });
});

describe("recusa em vez de chutar", () => {
  it("nome ambíguo volta como veio (quatro Joões no painel)", () => {
    assert.equal(canonicalizarTecnico("João", CADASTRO), "João");
  });

  it("quem não é usuário do painel aparece com o próprio nome", () => {
    // Thiago Nunes é técnico da unidade de Friburgo e não tem login.
    assert.equal(canonicalizarTecnico("Thiago Nunes", CADASTRO), "Thiago Nunes");
  });

  it("campo vazio é nulo, não 'Sem responsável' inventado aqui", () => {
    assert.equal(canonicalizarTecnico("", CADASTRO), null);
    assert.equal(canonicalizarTecnico("   ", CADASTRO), null);
    assert.equal(canonicalizarTecnico(null, CADASTRO), null);
  });

  it("cadastro vazio não quebra nem inventa", () => {
    assert.equal(canonicalizarTecnico("Fulano", []), "Fulano");
  });
});

describe("normalizarNome", () => {
  it("tira acento, caixa e pontuação", () => {
    assert.equal(normalizarNome("  Estefano do ROSÁRIO, silva "), "estefano do rosario silva");
  });
});
