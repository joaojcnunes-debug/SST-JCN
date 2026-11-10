import { test } from "node:test";
import assert from "node:assert/strict";
import { associadoAguardandoInicio, ehAssociado, ehResponsavelDocumento, estaNoDocumento, podeConcluirDocumento, responsavelAoConcluir } from "./inicio";

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

test("na 1ª conclusão o crédito vai para o associado que clicou; reabrir não muda a pessoa; quem está fora não leva", () => {
  const base = { nome: "João", associado: true, primeiraConclusaoEm: null, primeiraConclusaoPor: null };
  assert.equal(responsavelAoConcluir(base), "João");
  // Supervisor fora do documento: null mantém o responsável atual.
  assert.equal(responsavelAoConcluir({ ...base, associado: false }), null);
  // Reconclusão: volta o nome da 1ª conclusão, mesmo com outra pessoa clicando.
  assert.equal(responsavelAoConcluir({ ...base, primeiraConclusaoEm: "2026-10-01T12:00:00Z", primeiraConclusaoPor: "Maria" }), "Maria");
  // 1ª conclusão antiga sem nome gravado: mantém o responsável atual.
  assert.equal(responsavelAoConcluir({ ...base, primeiraConclusaoEm: "2026-10-01T12:00:00Z" }), null);
});

test("em elaboração, qualquer associado conclui, mesmo com outra pessoa como responsável", () => {
  const base = { elaboracaoStatus: "EM_ELABORACAO", supervisor: false, associado: false, responsavel: false, soConsulta: false };
  assert.equal(podeConcluirDocumento({ ...base, associado: true }), true);
  assert.equal(podeConcluirDocumento({ ...base, responsavel: true }), true);
  assert.equal(podeConcluirDocumento({ ...base, supervisor: true }), true);
  // Quem não está no documento, ou só consulta, não conclui.
  assert.equal(podeConcluirDocumento(base), false);
  assert.equal(podeConcluirDocumento({ ...base, associado: true, soConsulta: true }), false);
  // Ainda não iniciado ou já entregue: ninguém conclui, nem o supervisor.
  for (const elaboracaoStatus of ["PENDENTE", null, "CONCLUIDO"]) {
    assert.equal(podeConcluirDocumento({ ...base, elaboracaoStatus, associado: true, supervisor: true }), false);
  }
});
