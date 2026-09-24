import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  diaDaSemana,
  diasNoMes,
  mesAnterior,
  mesSeguinte,
  rotuloMes,
  seriePorDia,
  seriePorSemana,
  totaisDoMes,
  type UsoDiaRow,
} from "./relatorio";

const linha = (dia: string, minutos: number, pessoas = 1): UsoDiaRow => ({
  dia,
  minutos,
  pessoas,
  entrou_em: `${dia}T11:00:00Z`,
  saiu_em: `${dia}T20:00:00Z`,
});

describe("calendario", () => {
  test("dias no mes e virada de ano", () => {
    assert.equal(diasNoMes("2026-02"), 28);
    assert.equal(diasNoMes("2028-02"), 29);
    assert.equal(diasNoMes("2026-09"), 30);
    assert.equal(mesAnterior("2026-01"), "2025-12");
    assert.equal(mesSeguinte("2026-12"), "2027-01");
    assert.equal(rotuloMes("2026-09"), "Setembro 2026");
  });
  test("dia da semana nao depende do fuso da maquina", () => {
    assert.equal(diaDaSemana("2026-09-16"), 3); // quarta
    assert.equal(diaDaSemana("2026-09-20"), 0); // domingo
  });
});

describe("seriePorDia", () => {
  test("todos os dias do mes, zero onde nao ha dado, futuro marcado", () => {
    const s = seriePorDia("2026-09", [linha("2026-09-16", 120, 5), linha("2026-09-02", 30)], "2026-09-16");
    assert.equal(s.length, 30);
    assert.equal(s[15].dia, "2026-09-16");
    assert.equal(s[15].minutos, 120);
    assert.equal(s[15].pessoas, 5);
    assert.equal(s[15].futuro, false);
    assert.equal(s[16].futuro, true);
    assert.equal(s[0].minutos, 0);
    assert.equal(s[1].minutos, 30);
  });
  test("fim de semana marcado", () => {
    const s = seriePorDia("2026-09", [], "2026-09-30");
    assert.equal(s[4].dia, "2026-09-05"); // sábado
    assert.equal(s[4].fimDeSemana, true);
    assert.equal(s[6].fimDeSemana, false); // segunda 07/09
  });
});

describe("seriePorSemana", () => {
  test("setembro/2026 comeca numa terca: S1 = 01–06, S2 = 07–13, ... S5 = 28–30", () => {
    const pontos = seriePorDia("2026-09", [linha("2026-09-01", 60), linha("2026-09-07", 30), linha("2026-09-08", 30, 3)], "2026-09-30");
    const sem = seriePorSemana(pontos);
    assert.deepEqual(sem.map((s) => [s.rotulo, s.de, s.ate]), [
      ["S1", "2026-09-01", "2026-09-06"],
      ["S2", "2026-09-07", "2026-09-13"],
      ["S3", "2026-09-14", "2026-09-20"],
      ["S4", "2026-09-21", "2026-09-27"],
      ["S5", "2026-09-28", "2026-09-30"],
    ]);
    assert.equal(sem[0].minutos, 60);
    assert.equal(sem[1].minutos, 60);
    assert.equal(sem[1].diasComUso, 2);
    assert.equal(sem[1].pessoasMax, 3);
  });
});

describe("totaisDoMes", () => {
  test("total, dias com uso, media e pico", () => {
    const pontos = seriePorDia("2026-09", [linha("2026-09-01", 60, 2), linha("2026-09-02", 180, 7), linha("2026-09-03", 60, 3)], "2026-09-30");
    const t = totaisDoMes(pontos);
    assert.equal(t.totalMinutos, 300);
    assert.equal(t.diasComUso, 3);
    assert.equal(t.mediaPorDiaComUso, 100);
    assert.deepEqual(t.pico, { dia: "2026-09-02", minutos: 180, pessoas: 7 });
  });
  test("mes vazio nao divide por zero", () => {
    const t = totaisDoMes(seriePorDia("2026-09", [], "2026-09-30"));
    assert.equal(t.mediaPorDiaComUso, 0);
    assert.equal(t.pico, null);
  });
});
