import { test } from "node:test";
import assert from "node:assert/strict";
import { associadoAguardandoInicio, ehAssociado } from "./inicio";

const eu = { id_usuario: "U1", nome: "Sarah Fonseca" };
const naLista = [{ id_usuario: "U1", nome: "Sarah Fonseca" }, { id_usuario: "U2", nome: "Ana" }];

test("associado só abre com a própria sessão correndo; supervisor/admin, não associado e entregue abrem direto", () => {
  assert.equal(associadoAguardandoInicio(eu, false, naLista, "PENDENTE", false), true);
  assert.equal(associadoAguardandoInicio(eu, false, naLista, null, false), true);
  // Em elaboração (outra pessoa iniciou ou eu pausei): precisa Retomar.
  assert.equal(associadoAguardandoInicio(eu, false, naLista, "EM_ELABORACAO", false), true);
  assert.equal(associadoAguardandoInicio(eu, false, naLista, "EM_ELABORACAO", true), false);
  assert.equal(associadoAguardandoInicio(eu, false, naLista, "CONCLUIDO", false), false);
  assert.equal(associadoAguardandoInicio(eu, true, naLista, "PENDENTE", false), false);
  assert.equal(associadoAguardandoInicio(eu, false, [{ id_usuario: "U9", nome: "Outra Pessoa" }], "PENDENTE", false), false);
  assert.equal(associadoAguardandoInicio(null, false, naLista, "PENDENTE", false), false);
  // Associado antigo gravado só pelo nome (sem id) também conta.
  assert.equal(ehAssociado(eu, [{ id_usuario: null, nome: " sarah fonseca " }]), true);
});
