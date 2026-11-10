import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { atalhosData, diasEntre, proximaSegunda, rotuloData, somarDias } from "./datas-rapidas";

describe("Atalhos de data da tarefa", () => {
  test("somar dias atravessa mês e ano", () => {
    assert.equal(somarDias("2026-11-29", 3), "2026-12-02");
    assert.equal(somarDias("2026-12-31", 1), "2027-01-01");
    assert.equal(somarDias("2026-03-01", -1), "2026-02-28");
  });

  test("Próx. semana é a segunda-feira que vem (numa segunda, a da semana seguinte)", () => {
    assert.equal(proximaSegunda("2026-11-10"), "2026-11-16"); // terça
    assert.equal(proximaSegunda("2026-11-08"), "2026-11-09"); // domingo
    assert.equal(proximaSegunda("2026-11-14"), "2026-11-16"); // sábado
    assert.equal(proximaSegunda("2026-11-09"), "2026-11-16"); // segunda
  });

  test("os 4 atalhos, nesta ordem", () => {
    assert.deepEqual(atalhosData("2026-11-10"), [
      { rotulo: "Hoje", data: "2026-11-10" },
      { rotulo: "Amanhã", data: "2026-11-11" },
      { rotulo: "+3 dias", data: "2026-11-13" },
      { rotulo: "Próx. semana", data: "2026-11-16" },
    ]);
  });

  test("rótulo com hoje/amanhã/ontem", () => {
    assert.equal(rotuloData("2026-11-10", "2026-11-10"), "10/11/2026 (hoje)");
    assert.equal(rotuloData("2026-11-11", "2026-11-10"), "11/11/2026 (amanhã)");
    assert.equal(rotuloData("2026-11-09", "2026-11-10"), "09/11/2026 (ontem)");
    assert.equal(rotuloData("2026-12-25", "2026-11-10"), "25/12/2026");
    assert.equal(diasEntre("2026-11-10", "2026-11-03"), -7);
  });
});
