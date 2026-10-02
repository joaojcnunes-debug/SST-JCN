import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { avaliarFator, contagemParaAet, indiceProbabilidadeSugerida, recalcularAihaOrganizacional } from "./aiha-organizacional";
import type { MatrizRisco } from "@/lib/supabase/types";

// A matriz AIHA ativa no banco (MTZ-EC03227A).
const AIHA = {
  probabilidades: ["Não há exposição", "Exposição a níveis baixos", "Exposição moderada", "Exposição elevada", "Exposição elevadíssima"],
  severidades: ["Pouca importância", "Preocupantes", "Severos", "Irreversíveis", "Ameaça"],
  pesos_prob: [0, 1, 2, 3, 4],
  pesos_sev: [0, 1, 2, 3, 4],
  faixas: [
    { min: 0, max: 0, nivel: "Trivial" },
    { min: 1, max: 2, nivel: "Baixo" },
    { min: 3, max: 6, nivel: "Moderado" },
    { min: 7, max: 10, nivel: "Alto" },
    { min: 11, max: 999, nivel: "Muito Alto" },
  ],
  lookup: [],
} as unknown as MatrizRisco;

describe("sem sinal observado marcado → níveis mais baixos", () => {
  test("fica em Não há exposição × Pouca importância = Trivial", () => {
    const r = avaliarFator({ fator: "assedio", sinaisMarcados: 0, sinaisTotal: 6, matriz: AIHA });
    assert.equal(r.probabilidade, "Não há exposição");
    assert.equal(r.severidade, "Pouca importância");
    assert.equal(r.nivel, "Trivial");
  });
  test("escolha manual anterior não vale sem sinal (volta ao mais baixo)", () => {
    const r = avaliarFator({
      fator: "assedio", sinaisMarcados: 0, sinaisTotal: 6, matriz: AIHA,
      anterior: { probabilidade: "Exposição elevada", severidade: "Ameaça", nivel: "Muito Alto", prob_manual: true, sev_manual: true },
    });
    assert.equal(r.nivel, "Trivial");
    assert.equal(r.prob_manual, false);
  });
  test("não conta para o Necessita AET", () => {
    const r = avaliarFator({ fator: "assedio", sinaisMarcados: 0, sinaisTotal: 6, matriz: AIHA });
    assert.deepEqual(contagemParaAet({ assedio: r }), { altos: 0, moderados: 0 });
  });
});

describe("probabilidade sugerida pela proporção de sinais", () => {
  test("faixas", () => {
    assert.equal(indiceProbabilidadeSugerida(0, 6, 5), 0);
    assert.equal(indiceProbabilidadeSugerida(1, 6, 5), 2);
    assert.equal(indiceProbabilidadeSugerida(2, 6, 5), 2);
    assert.equal(indiceProbabilidadeSugerida(4, 6, 5), 3);
    assert.equal(indiceProbabilidadeSugerida(6, 6, 5), 4);
  });
  test("nunca passa do tamanho da escala", () => {
    assert.equal(indiceProbabilidadeSugerida(6, 6, 3), 2);
  });
});

describe("com sinais: nível pela ponderação da matriz (peso_prob × peso_sev)", () => {
  test("assédio com 1 de 6 sinais = 2 × 3 = Moderado", () => {
    const r = avaliarFator({ fator: "assedio", sinaisMarcados: 1, sinaisTotal: 6, matriz: AIHA });
    assert.equal(r.probabilidade, "Exposição moderada");
    assert.equal(r.severidade, "Irreversíveis");
    assert.equal(r.nivel, "Moderado");
  });
  test("assédio com 4 de 6 = 3 × 3 = Alto; com 6 de 6 = 4 × 3 = Muito Alto", () => {
    assert.equal(avaliarFator({ fator: "assedio", sinaisMarcados: 4, sinaisTotal: 6, matriz: AIHA }).nivel, "Alto");
    assert.equal(avaliarFator({ fator: "assedio", sinaisMarcados: 6, sinaisTotal: 6, matriz: AIHA }).nivel, "Muito Alto");
  });
  test("subcarga com 1 de 5 = 2 × 1 = Baixo", () => {
    assert.equal(avaliarFator({ fator: "subcarga", sinaisMarcados: 1, sinaisTotal: 5, matriz: AIHA }).nivel, "Baixo");
  });
  test("escolha manual do técnico vence a sugestão", () => {
    const r = avaliarFator({
      fator: "subcarga", sinaisMarcados: 1, sinaisTotal: 5, matriz: AIHA,
      anterior: { probabilidade: "Exposição elevadíssima", severidade: "Ameaça", nivel: "Baixo", prob_manual: true, sev_manual: true },
    });
    assert.equal(r.nivel, "Muito Alto");
    assert.equal(r.prob_manual, true);
  });
  test("escolha manual que não existe mais na matriz volta para a sugestão", () => {
    const r = avaliarFator({
      fator: "subcarga", sinaisMarcados: 1, sinaisTotal: 5, matriz: AIHA,
      anterior: { probabilidade: "Frequente", severidade: "Preocupantes", nivel: "Baixo", prob_manual: true },
    });
    assert.equal(r.probabilidade, "Exposição moderada");
    assert.equal(r.prob_manual, false);
  });
});

test("recalcular mantém só fatores marcados Sim", () => {
  const r = recalcularAihaOrganizacional({
    checklist: { assedio: "sim", subcarga: "nao", sobrecarga: "nao_identificado" },
    sinaisMarcados: { assedio: ["a", "b"] },
    totalSinais: () => 6,
    anterior: { subcarga: { probabilidade: "x", severidade: "y", nivel: "Alto" } },
    matriz: AIHA,
  });
  assert.deepEqual(Object.keys(r), ["assedio"]);
});

test("contagem para o Necessita AET", () => {
  const c = contagemParaAet({
    a: { probabilidade: "", severidade: "", nivel: "Muito Alto" },
    b: { probabilidade: "", severidade: "", nivel: "Alto" },
    c: { probabilidade: "", severidade: "", nivel: "Moderado" },
    d: { probabilidade: "", severidade: "", nivel: "Baixo" },
    e: { probabilidade: "", severidade: "", nivel: null },
  });
  assert.deepEqual(c, { altos: 2, moderados: 1 });
});
