import { test } from "node:test";
import assert from "node:assert/strict";
import { alternarDocumento, alternarEmpresa, documentosUsados, empresasAtivas, temEscolhaPropria } from "./selecao-grupo";
import type { DocumentoFonte } from "./fontes";

const doc = (id: string, idEmpresa: string, origem: "AEP" | "DRPS" | "QPS", data: string) => ({ id, idEmpresa, origem, data } as unknown as DocumentoFonte);
const DOCS = [
  doc("A1", "E1", "AEP", "2026-01-01"), doc("A2", "E1", "AEP", "2026-06-01"), doc("Q1", "E1", "QPS", "2026-05-01"),
  doc("A3", "E2", "AEP", "2026-03-01"),
];

test("sem escolha gravada: todas as empresas, o mais recente de cada tipo", () => {
  assert.deepEqual([...documentosUsados(DOCS, ["E1", "E2"], {})].sort(), ["A2", "A3", "Q1"]);
  assert.equal(temEscolhaPropria({}), false);
});

test("empresa desmarcada sai; empresa sem escolha segue o padrão", () => {
  const g = { psico_empresas_fora: ["E2"], psico_documentos: { E1: ["A1"] } };
  const ativos = empresasAtivas(["E1", "E2"], g);
  assert.deepEqual(ativos, ["E1"]);
  assert.deepEqual([...documentosUsados(DOCS, ativos, g)], ["A1"]);
  assert.equal(temEscolhaPropria(g), true);
});

test("marcar/desmarcar documento grava a escolha só daquela empresa", () => {
  const usados = documentosUsados(DOCS, ["E1", "E2"], {});
  const m = alternarDocumento(DOCS, usados, {}, "Q1");
  assert.deepEqual(m, { E1: ["A2"] });
  const m2 = alternarDocumento(DOCS, documentosUsados(DOCS, ["E1", "E2"], { psico_documentos: m }), { psico_documentos: m }, "A1");
  assert.deepEqual(m2, { E1: ["A2", "A1"] });
  assert.deepEqual(alternarEmpresa({ psico_empresas_fora: ["E2"] }, "E2"), []);
  assert.deepEqual(alternarEmpresa({}, "E2"), ["E2"]);
});
