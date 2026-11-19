import { test } from "node:test";
import assert from "node:assert/strict";
import { aplicarNaTela, ehFalhaDeRede, lerFila, marcarAtividadeLocal } from "./campo-offline";

const eu = { id_usuario: "U1", nome: "Ana" };

test("ehFalhaDeRede: sem sinal ou erro de fetch; erro do banco não", () => {
  assert.equal(ehFalhaDeRede(new Error("qualquer"), false), true);
  assert.equal(ehFalhaDeRede({ message: "TypeError: Failed to fetch" }), true);
  assert.equal(ehFalhaDeRede({ message: "inspecao ja concluida" }), false);
});

test("lerFila: ignora lixo", () => {
  assert.deepEqual(lerFila("nada"), []);
  assert.equal(lerFila(JSON.stringify([{ tipo: "iniciar", idInspecao: "I", quando: "2026-11-19T10:00:00Z" }, { tipo: "x" }])).length, 1);
});

test("aplicarNaTela: iniciar abre provisória; pausar fecha com motivo e horário", () => {
  const a = aplicarNaTela([], { tipo: "iniciar", idInspecao: "I", quando: "2026-11-19T10:00:00Z" }, eu);
  assert.equal(a.length, 1);
  assert.equal(a[0].fim, null);
  assert.ok(a[0].id_sessao.startsWith("local-"));
  const de2 = aplicarNaTela(a, { tipo: "iniciar", idInspecao: "I", quando: "2026-11-19T10:05:00Z" }, eu);
  assert.equal(de2.length, 1, "não abre duas");
  const b = aplicarNaTela(a, { tipo: "pausar", idInspecao: "I", motivo: "DESLOCAMENTO", quando: "2026-11-19T11:00:00Z" }, eu);
  assert.equal(b[0].fim, "2026-11-19T11:00:00Z");
  assert.equal(b[0].motivo_fim, "DESLOCAMENTO");
});

test("marcarAtividadeLocal: só a provisória aberta", () => {
  const a = aplicarNaTela([], { tipo: "iniciar", idInspecao: "I", quando: "2026-11-19T10:00:00Z" }, eu);
  const b = marcarAtividadeLocal(a, "2026-11-19T10:40:00Z");
  assert.equal(b[0].ultima_atividade, "2026-11-19T10:40:00Z");
});
