import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ehMinha, type CtxMinhas, type MinhaCandidata } from "./minhas";

const EU = "emilia.reis@chabra.com.br";
const vinculos: Record<string, { usuario_email: string; tipo: string }[]> = {
  "RRN-44647": [
    { usuario_email: "giovanna.terrason@chabra.com.br", tipo: "responsavel" },
    { usuario_email: EU, tipo: "seguidor" },
  ],
  "RRN-33635": [{ usuario_email: EU, tipo: "responsavel" }],
};
const ctx = (extra: Partial<CtxMinhas> = {}): CtxMinhas => ({
  email: EU,
  nome: "Emilia dos Reis",
  vinculadosDe: (id) => vinculos[id] ?? [],
  chaveCriador: (t) => (t.created_by && t.created_by !== "importador" ? `e:${t.created_by}` : null),
  tarefasPorSubtarefa: new Set(["RRN-8161", "RRS-8164"]),
  subtarefasMinhas: new Set(["SRR-8164"]),
  ...extra,
});
const t = (id: string, x: Partial<MinhaCandidata> = {}): MinhaCandidata => ({ id_tarefa: id, responsavel: null, created_by: "importador", ...x });

describe("ehMinha", () => {
  test("responsável pelo nome (como antes)", () => {
    assert.equal(ehMinha(t("TRF-1", { responsavel: "João Lima, Emilia dos Reis" }), ctx()), true);
  });
  test("responsável ou seguidora pelo e-mail — o alocado do Runrun que não é o 1º vira seguidor", () => {
    assert.equal(ehMinha(t("RRN-33635"), ctx({ nome: "Outro Nome" })), true);
    assert.equal(ehMinha(t("RRN-44647", { responsavel: "Giovanna Terrason" }), ctx()), true);
  });
  test("tarefa que criei", () => {
    assert.equal(ehMinha(t("TRF-2", { created_by: EU }), ctx()), true);
    assert.equal(ehMinha(t("TRF-3", { created_by: "outra@chabra.com.br" }), ctx()), false);
  });
  test("alocada numa subtarefa aberta: a mãe e a janela da subtarefa", () => {
    assert.equal(ehMinha(t("RRN-8161"), ctx()), true);
    assert.equal(ehMinha(t("RRS-8164"), ctx()), true);
    assert.equal(ehMinha(t("RRN-9999"), ctx()), false);
  });
  test("linha de subtarefa do Mostrar: só a própria subtarefa, não o criador/vínculos herdados da mãe", () => {
    assert.equal(ehMinha(t("SUB:SRR-8164", { sub_linha: "SRR-8164" }), ctx()), true);
    assert.equal(ehMinha(t("SUB:SRR-1", { sub_linha: "SRR-1", created_by: EU }), ctx()), false);
    assert.equal(ehMinha(t("SUB:SRR-2", { sub_linha: "SRR-2", responsavel: "Emilia dos Reis" }), ctx()), true);
  });
  test("e-mail em maiúsculas no vínculo; sem e-mail só vale o nome", () => {
    assert.equal(ehMinha(t("X"), ctx({ vinculadosDe: () => [{ usuario_email: EU.toUpperCase() }] })), true);
    assert.equal(ehMinha(t("RRN-33635"), ctx({ email: null, nome: "Outro" })), false);
  });
});
