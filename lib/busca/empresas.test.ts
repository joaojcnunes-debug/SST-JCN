import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buscarEmpresas, fantasiaDistinto } from "./empresas";

describe("fantasiaDistinto (painel v0.3.793)", () => {
  it("mostra o fantasia quando difere do Nome", () => {
    assert.equal(
      fantasiaDistinto({ nome_empresa: "RAIA DROGASIL S.A", nome_fantasia: " RAIA DROGASIL S/A ITABORAÍ " }),
      "RAIA DROGASIL S/A ITABORAÍ",
    );
  });
  it("esconde vazio, nulo e igual ao Nome (sem diferenciar caixa)", () => {
    assert.equal(fantasiaDistinto({ nome_empresa: "EMS S/A", nome_fantasia: null }), null);
    assert.equal(fantasiaDistinto({ nome_empresa: "EMS S/A", nome_fantasia: "  " }), null);
    assert.equal(fantasiaDistinto({ nome_empresa: "Manhattan Bar LTDA", nome_fantasia: "MANHATTAN BAR LTDA" }), null);
  });
});

describe("buscarEmpresas acha a filial pelo fantasia", () => {
  it("razão repetida, fantasia distingue", () => {
    const empresas = [
      { id_empresa: "a", nome_empresa: "RAIA DROGASIL S.A", nome_fantasia: "RAIA DROGASIL S/A ITABORAÍ" },
      { id_empresa: "b", nome_empresa: "RAIA DROGASIL S.A", nome_fantasia: "DROGASIL CAMPOS CENTRO" },
    ];
    const r = buscarEmpresas(empresas, "itaborai");
    assert.deepEqual(r.itens.map((e) => e.id_empresa), ["a"]);
  });
});
