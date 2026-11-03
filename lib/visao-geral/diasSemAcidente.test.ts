import { test } from "node:test";
import assert from "node:assert/strict";
import { diasSemAcidente } from "./diasSemAcidente";

test("dias sem acidente com afastamento: conta do último, nunca negativo; sem registro = null", () => {
  assert.equal(diasSemAcidente(null, "2026-11-03"), null);
  assert.equal(diasSemAcidente(undefined, "2026-11-03"), null);
  assert.equal(diasSemAcidente("2026-11-03", "2026-11-03"), 0);
  assert.equal(diasSemAcidente("2026-10-04", "2026-11-03"), 30);
  assert.equal(diasSemAcidente("2025-11-03", "2026-11-03"), 365);
  // data com hora (timestamp) usa só o dia
  assert.equal(diasSemAcidente("2026-11-01T22:00:00-03:00", "2026-11-03"), 2);
  // data no futuro (digitação errada) não vira número negativo
  assert.equal(diasSemAcidente("2026-12-01", "2026-11-03"), 0);
});
