import { test } from "node:test";
import assert from "node:assert/strict";
import { linhaRegistroAssinatura } from "./registro-profissional";

test("folha de assinaturas: mesma prioridade de antes para os cargos conhecidos", () => {
  assert.equal(linhaRegistroAssinatura({ cargo: "Técnico de Segurança", registro_mte: "123" }), "Reg. MTE 123");
  assert.equal(linhaRegistroAssinatura({ cargo: "Psicóloga", crp: "05/41807" }), "CRP 05/41807");
  assert.equal(linhaRegistroAssinatura({ cargo: "Médico do Trabalho", crm: "123/SP" }), "CRM 123/SP");
  assert.equal(linhaRegistroAssinatura({ cargo: "Psicóloga", registro_mte: "9", crp: "1" }), "Reg. MTE 9");
});

test("cargo de outra área não sai mais como CRP", () => {
  assert.equal(linhaRegistroAssinatura({ cargo: "Engenheiro Civil", crp: "CREA 555" }), "Reg. CREA 555");
  assert.equal(linhaRegistroAssinatura({ cargo: null, crp: "777" }), "Reg. 777");
});

test("sem registro, sem linha", () => {
  assert.equal(linhaRegistroAssinatura({ cargo: "Psicóloga" }), null);
  assert.equal(linhaRegistroAssinatura(null), null);
});
