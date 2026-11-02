import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { produtosComResponsavelProprio, produtosDaAutomacao, produtosDoQuadro, produtosRepetidos } from "./produto-responsaveis";

const C = "campo:eb5d9daf-9b81-4903-bfd5-4fea654225e7";
const chk = (valor: string, resp?: string) => ({
  condicao: { all: [{ campo: C, op: "contains", valor }] },
  acoes: [{ tipo: "criar_subtarefas_modelo", ...(resp ? { responsavel_email: resp } : {}) }],
});

describe("funcionários por produto (v322)", () => {
  test("o produto vem da condição da automação de checklist", () => {
    assert.deepEqual(produtosDaAutomacao(chk("PGR")), ["PGR"]);
    assert.deepEqual(produtosDaAutomacao({ condicao: { all: [{ campo: C, op: "contains", valor: "PGR" }] }, acoes: [{ tipo: "comentar" }] }), []);
    assert.deepEqual(produtosDaAutomacao({ condicao: { all: [{ campo: "status_para", op: "=", valor: "X" }] }, acoes: [{ tipo: "criar_subtarefas_modelo" }] }), []);
  });
  test("lista do quadro sem repetir, NR - 6 antes de NR - 10", () => {
    assert.deepEqual(produtosDoQuadro([chk("NR - 10"), chk("PGR"), chk("NR - 06"), chk("PGR")]), ["NR - 06", "NR - 10", "PGR"]);
  });
  test("produto em duas linhas é avisado", () => {
    assert.deepEqual([...produtosRepetidos([{ produtos: ["PGR", "LI"] }, { produtos: ["LI", "LP"] }])], ["LI"]);
  });
  test("responsável na própria automação aparece como exceção", () => {
    assert.deepEqual([...produtosComResponsavelProprio([chk("PGR", "a@x.com"), chk("LI")])], [["PGR", "a@x.com"]]);
  });
});
