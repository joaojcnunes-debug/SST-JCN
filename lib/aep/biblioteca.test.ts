import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { fatoresComPadrao, idsPadrao, montarBiblioteca } from "./biblioteca";

const b = montarBiblioteca(
  [
    { fator: "assedio", ordem: 1, meio_propagacao: "Interação social", situacao_padrao: "Normal", tempo_exposicao_padrao: "Habitual" },
    { fator: "sobrecarga", ordem: 2, meio_propagacao: " interação SOCIAL ", situacao_padrao: "Normal", tempo_exposicao_padrao: "Intermitente" },
    { fator: "isolamento", ordem: 3, meio_propagacao: "Organização do trabalho", situacao_padrao: "Anormal", tempo_exposicao_padrao: "Habitual" },
  ],
  [
    { id_item: "M1", fator: null, topico: "meio", texto: "Interação social", status: "ativo" },
    { id_item: "P1", fator: "assedio", topico: "perigo", texto: "Assédio moral", status: "ativo", padrao: true },
  ],
);

describe("fatoresComPadrao", () => {
  test("acha os fatores cujo padrão é o texto — mesma comparação de idsPadrao", () => {
    assert.deepEqual(fatoresComPadrao(b, "meio", "Interação social").sort(), ["assedio", "sobrecarga"]);
    // Coerência: são exatamente os fatores em que a opção sai marcada por padrão.
    assert.deepEqual(idsPadrao(b, "sobrecarga", "meio"), ["M1"]);
    assert.deepEqual(idsPadrao(b, "isolamento", "meio"), []);
  });

  test("cada tópico comum olha a sua coluna", () => {
    assert.deepEqual(fatoresComPadrao(b, "tempo", "Habitual").sort(), ["assedio", "isolamento"]);
    assert.deepEqual(fatoresComPadrao(b, "situacao", "Anormal"), ["isolamento"]);
  });

  test("tópico por fator e texto vazio não casam nada", () => {
    // Nos tópicos por fator o padrão é a marca `padrao` do item, não texto.
    assert.deepEqual(fatoresComPadrao(b, "perigo", "Assédio moral"), []);
    assert.deepEqual(fatoresComPadrao(b, "meio", "  "), []);
    assert.deepEqual(fatoresComPadrao(null, "meio", "Interação social"), []);
  });
});
