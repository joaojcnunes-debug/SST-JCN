import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { avisoRevisao, diasAte, type ResumoTrava } from "./avisoRevisaoTrava";

// A data combinada com ele para revisar a trava por módulo (v236).
const REVISAR_EM = "2026-10-21";
const emLog = (revisar_em = REVISAR_EM): ResumoTrava => ({
  modo: "log",
  desde: "2026-09-21T17:54:49Z",
  revisar_em,
  tentativas: 175,
  contas: 11,
});
/** Meio-dia local do dia pedido — o dia "de verdade" de quem usa o painel. */
const dia = (iso: string) => new Date(`${iso}T12:00:00`);

describe("diasAte", () => {
  it("conta o dia inteiro, ancorado ao meio-dia local", () => {
    assert.equal(diasAte(REVISAR_EM, dia("2026-10-21")), 0);
    assert.equal(diasAte(REVISAR_EM, dia("2026-10-20")), 1);
    assert.equal(diasAte(REVISAR_EM, dia("2026-10-22")), -1);
    assert.equal(diasAte(REVISAR_EM, dia("2026-09-22")), 29);
  });

  it("não escorrega para o dia anterior no fuso de São Paulo (a armadilha do card)", () => {
    // 23h59 do dia 20 ainda é "falta 1"; 00h01 do dia 21 já é "hoje".
    assert.equal(diasAte(REVISAR_EM, new Date("2026-10-20T23:59:00-03:00")), 1);
    assert.equal(diasAte(REVISAR_EM, new Date("2026-10-21T00:01:00-03:00")), 0);
  });
});

describe("avisoRevisao", () => {
  it("fica calado enquanto a data está longe (hoje, 22/09: faltam 29 dias)", () => {
    assert.equal(avisoRevisao(emLog(), dia("2026-09-22")).mostrar, false);
    assert.equal(avisoRevisao(emLog(), dia("2026-10-13")).mostrar, false); // 8 dias
  });

  it("aparece na última semana e diz quantos dias faltam", () => {
    const sete = avisoRevisao(emLog(), dia("2026-10-14"));
    assert.equal(sete.mostrar, true);
    assert.equal(sete.quando, "em 7 dias");
    assert.equal(sete.venceu, false);
    assert.equal(avisoRevisao(emLog(), dia("2026-10-20")).quando, "amanhã");
    assert.equal(avisoRevisao(emLog(), dia("2026-10-21")).quando, "hoje");
  });

  it("NÃO some depois que a data passa — é o ponto do lembrete", () => {
    const depois = avisoRevisao(emLog(), dia("2026-10-22"));
    assert.equal(depois.mostrar, true);
    assert.equal(depois.venceu, true);
    assert.equal(depois.quando, "há 1 dia");
    const bemDepois = avisoRevisao(emLog(), dia("2026-11-20"));
    assert.equal(bemDepois.mostrar, true);
    assert.equal(bemDepois.quando, "há 30 dias");
  });

  it("some quando a decisão foi tomada (trava ligada)", () => {
    const ligada: ResumoTrava = { ...emLog(), modo: "trava" };
    assert.equal(avisoRevisao(ligada, dia("2026-10-22")).mostrar, false);
  });

  it("some se a data for adiada por SQL, sem tocar no código", () => {
    assert.equal(avisoRevisao(emLog("2026-12-01"), dia("2026-10-22")).mostrar, false);
  });

  it("não desenha nada sem dados (quem não pode ler o resumo)", () => {
    assert.equal(avisoRevisao(null, dia("2026-10-22")).mostrar, false);
    assert.equal(avisoRevisao(undefined, dia("2026-10-22")).mostrar, false);
  });
});
