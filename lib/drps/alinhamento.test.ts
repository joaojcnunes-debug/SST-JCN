import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { alinhamentoDoBloco } from "./blocos";

describe("alinhamentoDoBloco (v291)", () => {
  test("sem escolha nenhuma sai justificado, como desde a v0.3.737", () => {
    assert.equal(alinhamentoDoBloco(null, null, undefined, "ADM", "medidas"), "justify");
    assert.equal(alinhamentoDoBloco(undefined, {}, "Matriz", "ADM", "agravos"), "justify");
  });

  test("usa o valor do setor, campo por campo", () => {
    const porSetor = { ADM: { medidas: "left" as const } };
    assert.equal(alinhamentoDoBloco(null, porSetor, undefined, "ADM", "medidas"), "left");
    assert.equal(alinhamentoDoBloco(null, porSetor, undefined, "ADM", "agravos"), "justify");
  });

  test("a unidade sobrepõe o setor; sem valor próprio, herda o do setor", () => {
    const porSetor = { ADM: { medidas: "center" as const } };
    const porUnidade = { Filial: { ADM: { medidas: "right" as const } } };
    assert.equal(alinhamentoDoBloco(porUnidade, porSetor, "Filial", "ADM", "medidas"), "right");
    assert.equal(alinhamentoDoBloco(porUnidade, porSetor, "Matriz", "ADM", "medidas"), "center");
  });

  test("valor estranho gravado no banco é ignorado", () => {
    const porSetor = { ADM: { medidas: "meio" } } as never;
    assert.equal(alinhamentoDoBloco(null, porSetor, undefined, "ADM", "medidas"), "justify");
  });
});
