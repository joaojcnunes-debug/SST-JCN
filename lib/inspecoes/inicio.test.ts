import { test } from "node:test";
import assert from "node:assert/strict";
import { associadoAguardandoInicio } from "./inicio";

const eu = { id_usuario: "U1", nome: "Sarah Fonseca" };
const naLista = [{ id_usuario: "U1", nome: "Sarah Fonseca" }, { id_usuario: "U2", nome: "Ana" }];

test("associado espera Iniciar; supervisor/admin e quem não é associado abrem direto", () => {
  assert.equal(associadoAguardandoInicio(eu, false, naLista, "PENDENTE"), true);
  assert.equal(associadoAguardandoInicio(eu, false, naLista, null), true);
  assert.equal(associadoAguardandoInicio(eu, false, naLista, "EM_ELABORACAO"), false);
  assert.equal(associadoAguardandoInicio(eu, false, naLista, "CONCLUIDO"), false);
  assert.equal(associadoAguardandoInicio(eu, true, naLista, "PENDENTE"), false);
  assert.equal(associadoAguardandoInicio(eu, false, [{ id_usuario: "U9", nome: "Outra Pessoa" }], "PENDENTE"), false);
  assert.equal(associadoAguardandoInicio(null, false, naLista, "PENDENTE"), false);
  // Associado antigo gravado só pelo nome (sem id) também conta.
  assert.equal(associadoAguardandoInicio(eu, false, [{ id_usuario: null, nome: " sarah fonseca " }], "PENDENTE"), true);
});
