import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { avisoForaDoLimite, avisoTamanho, dividirPeloLimite, fotosEnviadas } from "./lote";

describe("dividirPeloLimite", () => {
  it("aceita tudo quando cabe", () => {
    assert.deepEqual(dividirPeloLimite(["a", "b"], 2, 8), { aceitas: ["a", "b"], recusadas: 0 });
  });

  it("completa o limite na ordem escolhida e conta o resto", () => {
    assert.deepEqual(dividirPeloLimite(["a", "b", "c", "d"], 6, 8), { aceitas: ["a", "b"], recusadas: 2 });
  });

  it("não aceita nada sem vaga", () => {
    assert.deepEqual(dividirPeloLimite(["a"], 8, 8), { aceitas: [], recusadas: 1 });
  });

  it("trata registro acima do limite como sem vaga", () => {
    assert.deepEqual(dividirPeloLimite(["a", "b"], 9, 8), { aceitas: [], recusadas: 2 });
  });
});

describe("textos", () => {
  it("concorda com a quantidade", () => {
    assert.equal(avisoForaDoLimite(1, 6), "1 imagem ficou de fora: o limite é de 6 fotos.");
    assert.equal(avisoForaDoLimite(3, 8), "3 imagens ficaram de fora: o limite é de 8 fotos.");
    assert.equal(avisoTamanho(2, 5), "2 imagens ficaram de fora por ter mais de 5 MB.");
    assert.equal(fotosEnviadas(1), "Foto enviada");
    assert.equal(fotosEnviadas(4), "4 fotos enviadas");
  });
});
