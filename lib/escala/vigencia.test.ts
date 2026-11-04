import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { fimAoLimpar, vespera } from "./vigencia";

describe("vespera", () => {
  test("volta um dia, inclusive na virada de mês e de ano", () => {
    assert.equal(vespera("2026-11-04"), "2026-11-03");
    assert.equal(vespera("2026-03-01"), "2026-02-28");
    assert.equal(vespera("2026-01-01"), "2025-12-31");
    assert.equal(vespera("2028-03-01"), "2028-02-29");
  });
});

describe("fimAoLimpar (0.3.231)", () => {
  const aberto = { vigencia_inicio: "2026-08-01", vigencia_fim: null };

  test("encerra na véspera da data escolhida, a mesma régua de salvar", () => {
    assert.deepEqual(fimAoLimpar(aberto, "2026-12-01"), { ok: true, vigencia_fim: "2026-11-30" });
  });

  test("data no passado também vale (não usa hoje)", () => {
    assert.deepEqual(fimAoLimpar(aberto, "2026-09-15"), { ok: true, vigencia_fim: "2026-09-14" });
  });

  test("um dia depois do início deixa o padrão valendo só no primeiro dia", () => {
    assert.deepEqual(fimAoLimpar(aberto, "2026-08-02"), { ok: true, vigencia_fim: "2026-08-01" });
  });

  test("recusa quando o padrão começa na data escolhida ou depois", () => {
    const r1 = fimAoLimpar(aberto, "2026-08-01");
    assert.equal(r1.ok, false);
    if (!r1.ok) assert.match(r1.motivo, /01\/08\/2026/);
    assert.equal(fimAoLimpar(aberto, "2026-07-10").ok, false);
  });

  test("padrão já encerrado: encurta se a data cai antes do fim", () => {
    const fechado = { vigencia_inicio: "2026-08-01", vigencia_fim: "2026-12-31" };
    assert.deepEqual(fimAoLimpar(fechado, "2026-11-10"), { ok: true, vigencia_fim: "2026-11-09" });
  });

  test("padrão já encerrado antes da data: nada a limpar", () => {
    const fechado = { vigencia_inicio: "2026-08-01", vigencia_fim: "2026-10-31" };
    assert.equal(fimAoLimpar(fechado, "2026-11-01").ok, false);
    assert.equal(fimAoLimpar(fechado, "2026-12-01").ok, false);
  });
});
