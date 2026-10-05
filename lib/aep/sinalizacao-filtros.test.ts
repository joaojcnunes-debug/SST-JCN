import { test } from "node:test";
import assert from "node:assert/strict";

import { FILTROS_VAZIOS, filtrarSinalizacao, filtrosAtivos, opcoesDistintas, questionarioPendente } from "./sinalizacao-filtros";
import type { EmpresaSinalizada } from "./sinalizacao";

function emp(id: string, p: Partial<EmpresaSinalizada>): EmpresaSinalizada {
  return {
    idEmpresa: id,
    nome: id,
    cnpj: null,
    avaliacoes: [],
    totalSetores: 1,
    totalAlertas: 1,
    totalAltos: 0,
    pior: "Moderado",
    ultimaData: null,
    precisaAet: false,
    precisaQuestionario: false,
    realizadaPor: "Ana",
    enviadoPor: null,
    temInspecao: false,
    idUnidade: null,
    municipio: null,
    uf: null,
    ...p,
  };
}

const lista = [
  emp("A", { pior: "Muito Alto", precisaAet: true, precisaQuestionario: true, idUnidade: "U1", temInspecao: true, enviadoPor: "Bia" }),
  emp("B", { pior: "Alto", precisaQuestionario: true, idUnidade: "U2" }),
  emp("C", { pior: "Baixo", idUnidade: "U1", realizadaPor: "Caio" }),
];
const quest = { A: { fase: "concluido" as const, doc: "DRPS" as const }, B: { fase: "andamento" as const, doc: "DRPS" as const } };
const ids = (r: EmpresaSinalizada[]) => r.map((e) => e.idEmpresa);

test("sem filtro devolve tudo", () => {
  assert.deepEqual(ids(filtrarSinalizacao(lista, FILTROS_VAZIOS, quest)), ["A", "B", "C"]);
  assert.equal(filtrosAtivos(FILTROS_VAZIOS), 0);
});

test("unidade, nível e altos", () => {
  assert.deepEqual(ids(filtrarSinalizacao(lista, { ...FILTROS_VAZIOS, unidade: "U1" }, quest)), ["A", "C"]);
  assert.deepEqual(ids(filtrarSinalizacao(lista, { ...FILTROS_VAZIOS, nivel: "altos" }, quest)), ["A", "B"]);
  assert.deepEqual(ids(filtrarSinalizacao(lista, { ...FILTROS_VAZIOS, nivel: "Baixo" }, quest)), ["C"]);
});

test("DRPS/Questionário: necessário, pendente (sem concluído) e não", () => {
  assert.deepEqual(ids(filtrarSinalizacao(lista, { ...FILTROS_VAZIOS, questionario: "necessario" }, quest)), ["A", "B"]);
  assert.deepEqual(ids(filtrarSinalizacao(lista, { ...FILTROS_VAZIOS, questionario: "pendente" }, quest)), ["B"]);
  assert.deepEqual(ids(filtrarSinalizacao(lista, { ...FILTROS_VAZIOS, questionario: "nao" }, quest)), ["C"]);
  assert.equal(questionarioPendente(lista[1], undefined), true);
});

test("AET, entrega e pessoas", () => {
  assert.deepEqual(ids(filtrarSinalizacao(lista, { ...FILTROS_VAZIOS, aet: "sim" }, quest)), ["A"]);
  assert.deepEqual(ids(filtrarSinalizacao(lista, { ...FILTROS_VAZIOS, entrega: "sem" }, quest)), ["B", "C"]);
  assert.deepEqual(ids(filtrarSinalizacao(lista, { ...FILTROS_VAZIOS, realizadaPor: "Caio" }, quest)), ["C"]);
  assert.deepEqual(ids(filtrarSinalizacao(lista, { ...FILTROS_VAZIOS, enviadaPor: "Bia", aet: "sim" }, quest)), ["A"]);
});

test("opções distintas", () => {
  assert.deepEqual(opcoesDistintas(["b", " a", null, "", "b"]), ["a", "b"]);
});
