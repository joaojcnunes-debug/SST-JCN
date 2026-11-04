import { test } from "node:test";
import assert from "node:assert/strict";
import { eventosAlteracao, mensagemPendencias, pendenciasParaConcluir } from "./alteracao-tarefa";

const tipos: Record<string, string> = { A_FAZER: "nao_iniciado", FAZENDO: "ativo", FEITO: "concluido" };
const tipo = (s: string) => tipos[s];

test("pendenciasParaConcluir: só os pré-requisitos conhecidos e não concluídos", () => {
  const mapa = new Map([
    ["T1", { titulo: "Coleta", status: "FAZENDO" }],
    ["T2", { titulo: "Laudo", status: "FEITO" }],
  ]);
  const p = pendenciasParaConcluir(["T1", "T2", "FORA"], mapa, tipo);
  assert.deepEqual(p.map((t) => t.titulo), ["Coleta"]);
  assert.equal(mensagemPendencias(p), "Conclua antes: Coleta");
  assert.deepEqual(pendenciasParaConcluir([], mapa, tipo), []);
});

const antes = { status: "A_FAZER", responsavel: null, prazo: null, prioridade: "Media", titulo: "Visita" };
const nome = (s: string) => (s === "FEITO" ? "Feito" : s === "A_FAZER" ? "A fazer" : s);

test("eventosAlteracao: só a chave enviada gera evento (edição na Lista)", () => {
  assert.deepEqual(eventosAlteracao(antes, { status: "FEITO" }, nome), [
    { acao: "status", payload: { de: "A fazer", para: "Feito" } },
  ]);
  assert.deepEqual(eventosAlteracao(antes, { prazo: "2026-11-10" }, nome), [
    { acao: "prazo", payload: { de: "—", para: "2026-11-10" } },
  ]);
  assert.deepEqual(eventosAlteracao(antes, { responsavel: "Ana" }, nome), [
    { acao: "responsavel", payload: { de: "—", para: "Ana" } },
  ]);
});

test("eventosAlteracao: sem mudança não gera evento; prazo vazio equivale a null", () => {
  assert.deepEqual(eventosAlteracao(antes, { ...antes, prazo: "" }, nome), []);
  assert.deepEqual(eventosAlteracao(antes, {}, nome), []);
});
