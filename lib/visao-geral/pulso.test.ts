import { test } from "node:test";
import assert from "node:assert/strict";
import { acaoFechada, calcularPulso, composicaoPulso, contarAcoes, faixaDaNota } from "./pulso";

test("pulso: 70% documentos + 30% ações, exemplo aprovado", () => {
  const p = calcularPulso({ emDia: 98, vencendo: 11, vencido: 6, semValidade: 12 }, { abertas: 2, noPrazo: 2 });
  assert.equal(p.validos, 109);
  assert.equal(p.comValidade, 115);
  assert.equal(p.nota, 96); // 0,7 × 94,78 + 0,3 × 100
  assert.equal(p.faixa, "em_dia");
  assert.match(composicaoPulso(p), /109 válidos de 115/);
  assert.match(composicaoPulso(p), /12 sem validade \(fora da conta\)/);
});

test("pulso: sem documento com validade não há nota; sem ação aberta, ações = 100", () => {
  const p = calcularPulso({ emDia: 0, vencendo: 0, vencido: 0, semValidade: 5 }, { abertas: 0, noPrazo: 0 });
  assert.equal(p.nota, null);
  assert.equal(p.faixa, null);
  assert.equal(p.acoesPct, 100);
  const q = calcularPulso({ emDia: 0, vencendo: 0, vencido: 4, semValidade: 0 }, { abertas: 4, noPrazo: 0 });
  assert.equal(q.nota, 0);
  assert.equal(q.faixa, "critico");
});

test("faixas e ações abertas no prazo", () => {
  assert.equal(faixaDaNota(85), "em_dia");
  assert.equal(faixaDaNota(84), "atencao");
  assert.equal(faixaDaNota(60), "atencao");
  assert.equal(faixaDaNota(59), "critico");
  assert.equal(acaoFechada("Concluída"), true);
  assert.equal(acaoFechada("concluida"), true);
  assert.equal(acaoFechada("Cancelada"), true);
  assert.equal(acaoFechada("Em Andamento"), false);
  assert.equal(acaoFechada(null), false);
  const c = contarAcoes(
    [
      { status: "Pendente", when_prazo: "2026-11-10" },
      { status: "Em andamento", when_prazo: "2026-10-01" }, // atrasada
      { status: "Pendente", when_prazo: null }, // sem prazo = no prazo
      { status: "Concluída", when_prazo: "2026-01-01" }, // fechada: fora
      { status: "Pendente", when_prazo: "2026-11-03" }, // vence hoje: no prazo
    ],
    "2026-11-03",
  );
  assert.deepEqual(c, { abertas: 4, noPrazo: 3 });
});
