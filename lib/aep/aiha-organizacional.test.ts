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
    const r = avaliarFator({ fator: "assedio", sinaisMarcados: 0, matriz: AIHA });
    assert.equal(r.probabilidade, "Não há exposição");
    assert.equal(r.severidade, "Pouca importância");
    assert.equal(r.nivel, "Trivial");
  });
  test("escolha manual anterior não vale sem sinal (volta ao mais baixo)", () => {
    const r = avaliarFator({
      fator: "assedio", sinaisMarcados: 0, matriz: AIHA,
      anterior: { probabilidade: "Exposição elevada", severidade: "Ameaça", nivel: "Muito Alto", prob_manual: true, sev_manual: true },
    });
    assert.equal(r.nivel, "Trivial");
    assert.equal(r.prob_manual, false);
  });
  test("não conta para o Necessita AET", () => {
    const r = avaliarFator({ fator: "assedio", sinaisMarcados: 0, matriz: AIHA });
    assert.deepEqual(contagemParaAet({ assedio: r }), { altos: 0, moderados: 0 });
  });
});

describe("probabilidade sugerida: 1 sinal = 1 nível", () => {
  test("escala", () => {
    assert.equal(indiceProbabilidadeSugerida(0, 5), 0);
    assert.equal(indiceProbabilidadeSugerida(1, 5), 1);
    assert.equal(indiceProbabilidadeSugerida(2, 5), 2);
    assert.equal(indiceProbabilidadeSugerida(3, 5), 3);
    assert.equal(indiceProbabilidadeSugerida(4, 5), 4);
    assert.equal(indiceProbabilidadeSugerida(5, 5), 4);
  });
  test("nunca passa do tamanho da escala", () => {
    assert.equal(indiceProbabilidadeSugerida(5, 3), 2);
  });
});

describe("com sinais: nível pela ponderação da matriz (peso_prob × peso_sev)", () => {
  test("assédio com 1 sinal = 1 × 3 = Moderado", () => {
    const r = avaliarFator({ fator: "assedio", sinaisMarcados: 1, matriz: AIHA });
    assert.equal(r.probabilidade, "Exposição a níveis baixos");
    assert.equal(r.severidade, "Irreversíveis");
    assert.equal(r.nivel, "Moderado");
  });
  test("assédio com 3 sinais = 3 × 3 = Alto; com 4 ou 5 = 4 × 3 = Muito Alto", () => {
    assert.equal(avaliarFator({ fator: "assedio", sinaisMarcados: 3, matriz: AIHA }).nivel, "Alto");
    assert.equal(avaliarFator({ fator: "assedio", sinaisMarcados: 4, matriz: AIHA }).nivel, "Muito Alto");
    assert.equal(avaliarFator({ fator: "assedio", sinaisMarcados: 5, matriz: AIHA }).nivel, "Muito Alto");
  });
  test("subcarga (Preocupantes): 2 sinais = 2 × 1 = Baixo; 3 = Moderado", () => {
    assert.equal(avaliarFator({ fator: "subcarga", sinaisMarcados: 2, matriz: AIHA }).nivel, "Baixo");
    assert.equal(avaliarFator({ fator: "subcarga", sinaisMarcados: 3, matriz: AIHA }).nivel, "Moderado");
  });
  test("falta de suporte (Severos): 4 sinais = 4 × 2 = Alto", () => {
    assert.equal(avaliarFator({ fator: "falta_suporte", sinaisMarcados: 4, matriz: AIHA }).nivel, "Alto");
  });
  test("escolha manual do técnico vence a sugestão", () => {
    const r = avaliarFator({
      fator: "subcarga", sinaisMarcados: 1, matriz: AIHA,
      anterior: { probabilidade: "Exposição elevadíssima", severidade: "Ameaça", nivel: "Baixo", prob_manual: true, sev_manual: true },
    });
    assert.equal(r.nivel, "Muito Alto");
    assert.equal(r.prob_manual, true);
  });
  test("escolha manual que não existe mais na matriz volta para a sugestão", () => {
    const r = avaliarFator({
      fator: "subcarga", sinaisMarcados: 1, matriz: AIHA,
      anterior: { probabilidade: "Frequente", severidade: "Preocupantes", nivel: "Baixo", prob_manual: true },
    });
    assert.equal(r.probabilidade, "Exposição a níveis baixos");
    assert.equal(r.prob_manual, false);
  });
});

test("recalcular mantém só fatores marcados Sim", () => {
  const r = recalcularAihaOrganizacional({
    checklist: { assedio: "sim", subcarga: "nao", sobrecarga: "nao_identificado" },
    sinaisMarcados: { assedio: ["a", "b"] },
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
