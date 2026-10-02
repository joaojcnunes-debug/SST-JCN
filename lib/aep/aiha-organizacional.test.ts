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

describe("probabilidade sugerida pelos sinais", () => {
  test("faixas da proporção de sinais marcados", () => {
    assert.equal(indiceProbabilidadeSugerida(0, 6, 5), 1);
    assert.equal(indiceProbabilidadeSugerida(2, 6, 5), 2);
    assert.equal(indiceProbabilidadeSugerida(4, 6, 5), 3);
    assert.equal(indiceProbabilidadeSugerida(5, 6, 5), 4);
    assert.equal(indiceProbabilidadeSugerida(6, 6, 5), 4);
  });
  test("fator sem catálogo de sinais fica no nível baixo", () => {
    assert.equal(indiceProbabilidadeSugerida(0, 0, 5), 1);
  });
  test("nunca passa do tamanho da escala", () => {
    assert.equal(indiceProbabilidadeSugerida(6, 6, 3), 2);
  });
});

describe("nível pela ponderação da matriz (peso_prob × peso_sev)", () => {
  test("assédio sem sinais = 1 × 3 = Moderado", () => {
    const r = avaliarFator({ fator: "assedio", sinaisMarcados: 0, sinaisTotal: 6, matriz: AIHA });
    assert.equal(r.probabilidade, "Exposição a níveis baixos");
    assert.equal(r.severidade, "Irreversíveis");
    assert.equal(r.nivel, "Moderado");
  });
  test("assédio com 4 de 6 sinais = 3 × 3 = Alto; com 6 de 6 = 4 × 3 = Muito Alto", () => {
    assert.equal(avaliarFator({ fator: "assedio", sinaisMarcados: 4, sinaisTotal: 6, matriz: AIHA }).nivel, "Alto");
    assert.equal(avaliarFator({ fator: "assedio", sinaisMarcados: 6, sinaisTotal: 6, matriz: AIHA }).nivel, "Muito Alto");
  });
  test("subcarga sem sinais = 1 × 1 = Baixo", () => {
    assert.equal(avaliarFator({ fator: "subcarga", sinaisMarcados: 0, sinaisTotal: 5, matriz: AIHA }).nivel, "Baixo");
  });
  test("escolha manual do técnico vence a sugestão e é preservada", () => {
    const r = avaliarFator({
      fator: "subcarga", sinaisMarcados: 0, sinaisTotal: 5, matriz: AIHA,
      anterior: { probabilidade: "Exposição elevadíssima", severidade: "Ameaça", nivel: "Baixo", prob_manual: true, sev_manual: true },
    });
    assert.equal(r.nivel, "Muito Alto");
    assert.equal(r.prob_manual, true);
  });
  test("escolha manual que não existe mais na matriz volta para a sugestão", () => {
    const r = avaliarFator({
      fator: "subcarga", sinaisMarcados: 0, sinaisTotal: 5, matriz: AIHA,
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
  });
  assert.deepEqual(c, { altos: 2, moderados: 1 });
});
