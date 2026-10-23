import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { proximaGeracao, somarPeriodo } from "./recorrencia";

describe("somarPeriodo", () => {
  test("diária, semanal e mensal", () => {
    assert.equal(somarPeriodo("2026-10-21", "diaria", 1), "2026-10-22");
    assert.equal(somarPeriodo("2026-10-31", "diaria", 2), "2026-11-02");
    assert.equal(somarPeriodo("2026-10-21", "semanal", 1), "2026-10-28");
    assert.equal(somarPeriodo("2026-10-21", "mensal", 1), "2026-11-21");
  });
  test("mensal no fim do mês fica no último dia (como o Postgres)", () => {
    assert.equal(somarPeriodo("2027-01-31", "mensal", 1), "2027-02-28");
    assert.equal(somarPeriodo("2026-12-15", "mensal", 2), "2027-02-15");
  });
});

describe("proximaGeracao", () => {
  const hoje = "2026-10-21";
  test("nada mudou: mantém a data já agendada", () => {
    const ant = { recorrencia: { tipo: "diaria" as const, intervalo: 1, proxima_geracao: "2026-10-25" }, prazo: "2026-10-21" };
    assert.equal(proximaGeracao(ant, { tipo: "diaria", intervalo: 1, prazo: "2026-10-21", dataInicio: null, hoje }), "2026-10-25");
  });
  test("término corrigido (2030 → 2026): recalcula a partir do novo término", () => {
    const ant = { recorrencia: { tipo: "diaria" as const, intervalo: 1, proxima_geracao: "2030-10-20" }, prazo: "2030-10-20" };
    assert.equal(proximaGeracao(ant, { tipo: "diaria", intervalo: 1, prazo: "2026-10-21", dataInicio: "2026-10-20", hoje }), "2026-10-22");
  });
  test("tipo ou intervalo mudou: recalcula", () => {
    const ant = { recorrencia: { tipo: "diaria" as const, intervalo: 1, proxima_geracao: "2026-10-22" }, prazo: "2026-10-21" };
    assert.equal(proximaGeracao(ant, { tipo: "semanal", intervalo: 1, prazo: "2026-10-21", dataInicio: null, hoje }), "2026-10-28");
    assert.equal(proximaGeracao(ant, { tipo: "diaria", intervalo: 3, prazo: "2026-10-21", dataInicio: null, hoje }), "2026-10-24");
  });
  test("recorrência nova: um período depois do término (não duplica o mesmo dia)", () => {
    assert.equal(proximaGeracao(null, { tipo: "diaria", intervalo: 1, prazo: "2026-10-21", dataInicio: null, hoje }), "2026-10-22");
    assert.equal(proximaGeracao({ recorrencia: null, prazo: "2026-10-21" }, { tipo: "mensal", intervalo: 1, prazo: "2026-10-21", dataInicio: null, hoje }), "2026-11-21");
  });
  test("sem término: usa o início; sem início: hoje", () => {
    assert.equal(proximaGeracao(null, { tipo: "diaria", intervalo: 1, prazo: null, dataInicio: "2026-10-23", hoje }), "2026-10-24");
    assert.equal(proximaGeracao(null, { tipo: "semanal", intervalo: 1, prazo: null, dataInicio: null, hoje }), "2026-10-28");
  });
});
