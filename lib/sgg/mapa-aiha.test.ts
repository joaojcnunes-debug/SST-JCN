import test from "node:test";
import assert from "node:assert/strict";
import { criterioNivel1, criterioNivel2, RotuloDesconhecido } from "./mapa-aiha";

test("identidade nos rotulos da AIHA (inclui o 5o grau, aceito pelo SGG em 23/09)", () => {
  for (const p of ["Não há exposição", "Exposição a níveis baixos", "Exposição moderada",
                   "Exposição elevada", "Exposição elevadíssima"]) {
    assert.equal(criterioNivel1(p), p);
  }
  for (const s of ["Pouca importância", "Preocupantes", "Severos", "Irreversíveis", "Ameaça"]) {
    assert.equal(criterioNivel2(s), s);
  }
});

test("vocabulario legado mapeia por posicao", () => {
  assert.equal(criterioNivel1("Ocasional"), "Exposição moderada");
  assert.equal(criterioNivel1("Improvável"), "Não há exposição");
  assert.equal(criterioNivel1("Frequente"), "Exposição elevadíssima");
  assert.equal(criterioNivel2("Marginal"), "Preocupantes");
  assert.equal(criterioNivel2("Catastrófico"), "Irreversíveis");
});

test("rotulo desconhecido LANCA, nunca devolve um padrao", () => {
  assert.throws(() => criterioNivel1("Moderada"), RotuloDesconhecido);
  assert.throws(() => criterioNivel2("Severa"), RotuloDesconhecido);
  assert.throws(() => criterioNivel1(""), RotuloDesconhecido);
  assert.throws(() => criterioNivel1(null), RotuloDesconhecido);
});

test("o de-para nao consulta id_matriz -- 522 riscos legados apontam a AIHA", () => {
  // mesmo rotulo legado, qualquer id_matriz: o resultado e o mesmo.
  assert.equal(criterioNivel1("Ocasional"), "Exposição moderada");
});
