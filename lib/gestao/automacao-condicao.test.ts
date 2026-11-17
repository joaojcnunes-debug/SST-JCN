import { test } from "node:test";
import assert from "node:assert/strict";
import { clausulaPronta, condicaoParaGravar } from "./automacao-condicao";

test("cláusula pronta: com valor, ou com operador que não pede valor", () => {
  assert.equal(clausulaPronta({ campo: "status", op: "=", valor: "feito" }), true);
  assert.equal(clausulaPronta({ campo: "status", op: "=", valor: "  " }), false);
  assert.equal(clausulaPronta({ campo: "titulo", op: "vazio", valor: "" }), true);
  assert.equal(clausulaPronta({ campo: "", op: "=", valor: "x" }), false);
});

test("grava só as prontas; sem nenhuma, mantém o E/OU ligado com all vazio", () => {
  const all = [{ campo: "status", op: "=", valor: "feito" }, { campo: "prioridade", op: "=", valor: "" }];
  const any = [{ campo: "titulo", op: "nao_vazio", valor: "lixo" }];
  assert.deepEqual(condicaoParaGravar(all, any), {
    all: [{ campo: "status", op: "=", valor: "feito" }],
    any: [{ campo: "titulo", op: "nao_vazio", valor: "" }],
  });
  assert.deepEqual(condicaoParaGravar([{ campo: "status", op: "=", valor: "" }], []), { all: [] });
  assert.deepEqual(condicaoParaGravar([], []), { all: [] });
});
