import { test } from "node:test";
import assert from "node:assert/strict";
import { associadoAguardandoInicio, ehAssociado, ehResponsavelDocumento, estaNoDocumento } from "./inicio";

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

test("responsável sem linha de associado também inicia, e quem não está no documento segue fora (v332)", () => {
  const semLinha: { id_usuario: string; nome: string }[] = [];
  assert.equal(estaNoDocumento(eu, semLinha, " sarah fonseca "), true);
  assert.equal(associadoAguardandoInicio(eu, false, semLinha, "EM_ELABORACAO", false, "Sarah Fonseca"), true);
  assert.equal(associadoAguardandoInicio(eu, false, semLinha, "EM_ELABORACAO", true, "Sarah Fonseca"), false);
  assert.equal(associadoAguardandoInicio(eu, false, semLinha, "CONCLUIDO", false, "Sarah Fonseca"), false);
  assert.equal(associadoAguardandoInicio(eu, true, semLinha, "EM_ELABORACAO", false, "Sarah Fonseca"), false);
  assert.equal(estaNoDocumento(eu, semLinha, "Ana"), false);
  assert.equal(estaNoDocumento(eu, semLinha, null), false);
  assert.equal(estaNoDocumento(eu, naLista, "Ana"), true);
});

test("responsável é reconhecido sem diferenciar maiúsculas e espaços; vazio não é ninguém", () => {
  assert.equal(ehResponsavelDocumento("Sarah Fonseca", " sarah fonseca "), true);
  assert.equal(ehResponsavelDocumento("Sarah Fonseca", "Ana"), false);
  assert.equal(ehResponsavelDocumento("", ""), false);
  assert.equal(ehResponsavelDocumento(null, null), false);
});
