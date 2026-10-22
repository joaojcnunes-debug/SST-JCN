import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { filtroPeriodo } from "./periodo";

describe("período da lista: concluída conta pela conclusão (07/10)", () => {
  it("sem período não filtra", () => {
    assert.equal(filtroPeriodo("", ""), null);
    assert.equal(filtroPeriodo(undefined, undefined), null);
    assert.equal(filtroPeriodo("lixo", ""), null);
  });

  it("setembro: concluída pela conclusão no dia de SP, aberta pela visita", () => {
    assert.equal(
      filtroPeriodo("2026-09-01", "2026-09-30"),
      'and(status.eq.CONCLUIDA,concluida_em.not.is.null,concluida_em.gte."2026-09-01T00:00:00-03:00",concluida_em.lt."2026-10-01T00:00:00-03:00"),' +
        'and(status.eq.CONCLUIDA,concluida_em.is.null,created_at.gte."2026-09-01T00:00:00-03:00",created_at.lt."2026-10-01T00:00:00-03:00"),' +
        "and(status.neq.CONCLUIDA,data_inspecao.gte.2026-09-01,data_inspecao.lte.2026-09-30)",
    );
  });

  it("o Até vira o 1º instante do dia seguinte, inclusive na virada do ano", () => {
    const f = filtroPeriodo("", "2026-12-31")!;
    assert.match(f, /concluida_em\.lt\."2027-01-01T00:00:00-03:00"/);
    assert.doesNotMatch(f, /gte/);
  });
});
