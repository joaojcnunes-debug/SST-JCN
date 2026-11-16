import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { dataHora, quandoComentario, ehMeuComentario, textoCriacao } from "./comentarios-chat";

// Datas em hora local (new Date(ano, mês, …)) para o teste não depender do fuso da máquina.
const agora = new Date(2026, 10, 12, 10, 0, 0);
const iso = (...p: [number, number, number, number, number, number?]) => new Date(...p).toISOString();

describe("quandoComentario", () => {
  test("agora, minutos, hoje, ontem e data completa", () => {
    assert.equal(quandoComentario(iso(2026, 10, 12, 9, 59, 30), agora), "agora");
    assert.equal(quandoComentario(iso(2026, 10, 12, 10, 0, 40), agora), "agora"); // relógio um pouco atrasado
    assert.equal(quandoComentario(iso(2026, 10, 12, 9, 48, 0), agora), "há 12 min");
    assert.equal(quandoComentario(iso(2026, 10, 12, 8, 5, 0), agora), "hoje 08:05");
    assert.equal(quandoComentario(iso(2026, 10, 11, 17, 40, 0), agora), "ontem 17:40");
    assert.equal(quandoComentario(iso(2026, 10, 10, 9, 19, 0), agora), "10/11/2026 09:19");
  });
  test("virada do mês: ontem continua ontem", () => {
    assert.equal(quandoComentario(iso(2026, 9, 31, 23, 10, 0), new Date(2026, 10, 1, 8, 0, 0)), "ontem 23:10");
  });
  test("dataHora", () => {
    assert.equal(dataHora(iso(2026, 10, 11, 9, 19, 0)), "11/11/2026 09:19");
  });
});

describe("ehMeuComentario", () => {
  test("compara o nome sem acento, maiúscula e espaço sobrando", () => {
    assert.equal(ehMeuComentario("Suporte T.I", "Suporte T.I"), true);
    assert.equal(ehMeuComentario("João  Jefferson", "joao jefferson"), true);
    assert.equal(ehMeuComentario("Ana Clara", "Ana Renata"), false);
    assert.equal(ehMeuComentario(null, "Ana Clara"), false);
    assert.equal(ehMeuComentario("Ana Clara", ""), false);
  });
});

describe("textoCriacao", () => {
  test("pessoa, formulário e origens automáticas", () => {
    assert.equal(textoCriacao({ criadaPor: "Ana Clara", peloFormulario: false, createdBy: "ana.clara@chabra.com.br" }), "Tarefa criada por Ana Clara.");
    assert.equal(textoCriacao({ criadaPor: "Ordem de Serviço - Solicitação", peloFormulario: true, createdBy: "Formulário" }),
      "Tarefa criada a partir do formulário Ordem de Serviço - Solicitação.");
    assert.equal(textoCriacao({ criadaPor: null, peloFormulario: false, createdBy: "importador" }), "Tarefa trazida do Runrun para a Gestão.");
    assert.equal(textoCriacao({ criadaPor: null, peloFormulario: false, createdBy: "recorrencia" }), "Tarefa criada pela recorrência.");
    assert.equal(textoCriacao({ criadaPor: null, peloFormulario: false, createdBy: null }), "Tarefa criada.");
  });
});
