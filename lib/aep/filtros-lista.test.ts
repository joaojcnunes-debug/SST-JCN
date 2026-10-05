import { test } from "node:test";
import assert from "node:assert/strict";

import { FILTROS_LISTA_VAZIOS, filtrarAeps, filtrosListaAtivos, nivelAepRelatorio } from "./filtros-lista";
import type { AepRelatorio } from "@/lib/supabase/types";

function rel(id: string, p: Record<string, unknown>): AepRelatorio {
  return {
    id_relatorio: id,
    id_empresa: "E" + id,
    status: "RASCUNHO",
    data_elaboracao: "2026-06-01",
    responsavel_elaboracao: "Ana",
    empresas: { nome_empresa: "Empresa " + id, cnpj: null },
    setores: [],
    ...p,
  } as unknown as AepRelatorio;
}

const lista = [
  rel("1", {
    status: "CONCLUIDO",
    id_inspecao: "INS-1",
    setores: [{ necessita_aet: true, aiha_organizacional: { assedio: { nivel: "Alto" } } }],
  }),
  rel("2", {
    status: "EM_ANDAMENTO",
    responsavel_elaboracao: "Bruno",
    data_elaboracao: "2026-09-10",
    setores: [{ necessita_aet: false, aiha_organizacional: { subcarga: { nivel: "Baixo" } } }],
  }),
  rel("3", { empresas: { nome_empresa: "Padaria Central", cnpj: null } }),
];
const ids = (r: AepRelatorio[]) => r.map((x) => x.id_relatorio);

test("sem filtro devolve tudo", () => {
  assert.deepEqual(ids(filtrarAeps(lista, FILTROS_LISTA_VAZIOS)), ["1", "2", "3"]);
  assert.equal(filtrosListaAtivos(FILTROS_LISTA_VAZIOS), 0);
});

test("status, AET, nível, inspeção, responsável e período", () => {
  const f = FILTROS_LISTA_VAZIOS;
  assert.deepEqual(ids(filtrarAeps(lista, { ...f, status: "EM_ANDAMENTO" })), ["2"]);
  assert.deepEqual(ids(filtrarAeps(lista, { ...f, aet: "sim" })), ["1"]);
  assert.deepEqual(ids(filtrarAeps(lista, { ...f, aet: "nao" })), ["2", "3"]);
  assert.deepEqual(ids(filtrarAeps(lista, { ...f, nivel: "altos" })), ["1"]);
  assert.deepEqual(ids(filtrarAeps(lista, { ...f, nivel: "Baixo" })), ["2"]);
  assert.deepEqual(ids(filtrarAeps(lista, { ...f, inspecao: "com" })), ["1"]);
  assert.deepEqual(ids(filtrarAeps(lista, { ...f, responsavel: "Bruno" })), ["2"]);
  assert.deepEqual(ids(filtrarAeps(lista, { ...f, de: "2026-09-01" })), ["2"]);
  assert.deepEqual(ids(filtrarAeps(lista, { ...f, ate: "2026-08-31" })), ["1", "3"]);
});

test("busca por empresa e responsável; ignorar um filtro", () => {
  const f = FILTROS_LISTA_VAZIOS;
  assert.deepEqual(ids(filtrarAeps(lista, { ...f, busca: "padaria" })), ["3"]);
  assert.deepEqual(ids(filtrarAeps(lista, { ...f, busca: "bruno" })), ["2"]);
  assert.deepEqual(ids(filtrarAeps(lista, { ...f, status: "CONCLUIDO", aet: "sim" }, ["status"])), ["1"]);
  assert.equal(nivelAepRelatorio(lista[2]), null);
});
