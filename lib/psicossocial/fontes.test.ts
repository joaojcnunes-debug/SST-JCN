import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { fontesEscolhidas, guardadasDe, opcoesFonte, separarFontes, textoFontes } from "./fontes";

const PADRAO =
  "Cultura permissiva a desrespeito; ausência de canal de denúncia; liderança despreparada; comunicação violenta.";

describe("separarFontes", () => {
  test("texto padrão do tópico vira uma fonte por pedaço, sem o ponto final", () => {
    assert.deepEqual(separarFontes(PADRAO), [
      "Cultura permissiva a desrespeito",
      "ausência de canal de denúncia",
      "liderança despreparada",
      "comunicação violenta",
    ]);
  });
  test("vírgula também separa (pedido do usuário) e repetidos saem", () => {
    assert.deepEqual(separarFontes("a, b; A ,c"), ["a", "b", "c"]);
  });
  test("vazio e nulo viram lista vazia", () => {
    assert.deepEqual(separarFontes(""), []);
    assert.deepEqual(separarFontes(null), []);
  });
});

describe("fontesEscolhidas", () => {
  test("sem nada guardado = todas as fontes padrão (laudo antigo sai igual)", () => {
    assert.equal(fontesEscolhidas(undefined, PADRAO).length, 4);
  });
  test("guardado vazio = nenhuma fonte (o técnico desmarcou tudo)", () => {
    assert.deepEqual(fontesEscolhidas([], PADRAO), []);
  });
  test("guardado vale mesmo com fonte fora do padrão", () => {
    assert.deepEqual(fontesEscolhidas(["liderança despreparada", "nova"], PADRAO), ["liderança despreparada", "nova"]);
  });
});

test("opcoesFonte junta padrão e catálogo sem repetir", () => {
  assert.deepEqual(opcoesFonte("a; b", ["B", "c"]), ["a", "b", "c"]);
});

test("textoFontes volta ao formato do laudo", () => {
  assert.equal(textoFontes(["a", "b"]), "a; b.");
  assert.equal(textoFontes([]), "");
});

test("guardadasDe lê por setor e chave numérica ou texto", () => {
  const mapa = { ADM: { "0": ["x"] } };
  assert.deepEqual(guardadasDe(mapa, "ADM", 0), ["x"]);
  assert.equal(guardadasDe(mapa, "ADM", 1), undefined);
  assert.equal(guardadasDe(null, "ADM", 0), undefined);
});
