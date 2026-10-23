import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { acaoCompleta } from "./automacao-completa";

describe("automação completa (mesma regra do banco, v297)", () => {
  test("sem tipo ou tipo desconhecido não roda", () => {
    assert.equal(acaoCompleta(null), false);
    assert.equal(acaoCompleta({}), false);
    assert.equal(acaoCompleta({ tipo: "xyz" }), false);
  });
  test("ações que precisam de valor", () => {
    assert.equal(acaoCompleta({ tipo: "mover_status" }), false);
    assert.equal(acaoCompleta({ tipo: "mover_status", valor: "CONCLUIDO" }), true);
    assert.equal(acaoCompleta({ tipo: "definir_responsavel", valor: "  " }), false);
    assert.equal(acaoCompleta({ tipo: "definir_responsavel", valor: "Ana" }), true);
  });
  test("ações que precisam de destino, campo, modelo ou e-mails", () => {
    assert.equal(acaoCompleta({ tipo: "criar_tarefa_quadro" }), false);
    assert.equal(acaoCompleta({ tipo: "mover_tarefa_quadro", id_quadro_destino: "QDR-1" }), true);
    assert.equal(acaoCompleta({ tipo: "definir_campo", campo_id: "c1" }), true);
    assert.equal(acaoCompleta({ tipo: "criar_subtarefas_modelo" }), false);
    assert.equal(acaoCompleta({ tipo: "adicionar_vinculados", emails: [] }), false);
    assert.equal(acaoCompleta({ tipo: "adicionar_vinculados", emails: ["a@b.com"] }), true);
  });
  test("notificar e solicitar aprovação só precisam do tipo", () => {
    assert.equal(acaoCompleta({ tipo: "notificar" }), true);
    assert.equal(acaoCompleta({ tipo: "solicitar_aprovacao" }), true);
  });
});
