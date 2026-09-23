import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { formatarPrazoAcao } from "./prazo";

describe("formatarPrazoAcao", () => {
  test("data ISO pura sai em dd/mm/aaaa", () => {
    assert.equal(formatarPrazoAcao("2026-08-26"), "26/08/2026");
  });

  test("não volta um dia por causa do fuso (o bug do new Date(ISO))", () => {
    // new Date("2026-01-01") é UTC e, no nosso fuso, vira 31/12/2025.
    assert.equal(formatarPrazoAcao("2026-01-01"), "01/01/2026");
  });

  test("texto livre sai exatamente como o técnico escreveu", () => {
    assert.equal(formatarPrazoAcao("Imediato"), "Imediato");
    assert.equal(
      formatarPrazoAcao("30 dias após a entrega dos EPIs"),
      "30 dias após a entrega dos EPIs",
    );
    assert.equal(
      formatarPrazoAcao("Na próxima parada de manutenção"),
      "Na próxima parada de manutenção",
    );
  });

  test("texto que só COMEÇA com data não é convertido", () => {
    assert.equal(
      formatarPrazoAcao("2026-08-26 (se a peça chegar)"),
      "2026-08-26 (se a peça chegar)",
    );
  });

  test("vazio, nulo e só espaço viram string vazia", () => {
    assert.equal(formatarPrazoAcao(null), "");
    assert.equal(formatarPrazoAcao(undefined), "");
    assert.equal(formatarPrazoAcao(""), "");
    assert.equal(formatarPrazoAcao("   "), "");
  });

  test("espaço em volta não atrapalha a data", () => {
    assert.equal(formatarPrazoAcao("  2026-08-26  "), "26/08/2026");
  });
});
