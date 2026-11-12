import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { avisoAoMover, contarWip, estadoWip, type CartaoWip, type ColunaWip } from "./wip";

const cartoes: CartaoWip[] = [
  { id_tarefa: "A", status: "ELAB" },
  { id_tarefa: "B", status: "ELAB" },
  { id_tarefa: "C", status: "ELAB" },
  { id_tarefa: "D", status: "ENTRADA" },
  { id_tarefa: "E", status: "ELAB", sub_linha: { id: "s" } },
];
const resp: Record<string, string[]> = { A: ["ana@x.com"], B: ["Ana@x.com", "bia@x.com"], C: [], D: ["ana@x.com"] };
const de = (id: string) => resp[id] ?? [];
const elab = (extra: Partial<ColunaWip> = {}): ColunaWip => ({ slug: "ELAB", nome: "Elaboração", tipo: "ativo", limite_wip: 2, ...extra });

describe("contarWip", () => {
  test("deve contar só os cartões da coluna, sem linhas de subtarefa", () => {
    assert.equal(contarWip(cartoes, "ELAB", de).total, 3);
  });
  test("deve contar por responsável sem diferenciar maiúsculas", () => {
    const n = contarWip(cartoes, "ELAB", de);
    assert.equal(n.porPessoa.get("ana@x.com"), 2);
    assert.equal(n.porPessoa.get("bia@x.com"), 1);
  });
});

describe("estadoWip", () => {
  test("deve mostrar total/limite e marcar excedido quando passa do limite", () => {
    const e = estadoWip(elab(), contarWip(cartoes, "ELAB", de));
    assert.equal(e.texto, "3/2");
    assert.equal(e.excedido, true);
  });
  test("não deve mostrar nada quando a coluna não tem limite", () => {
    assert.equal(estadoWip(elab({ limite_wip: null }), contarWip(cartoes, "ELAB", de)).texto, null);
  });
  test("não deve aplicar limite em coluna de concluído", () => {
    assert.equal(estadoWip(elab({ tipo: "concluido" }), contarWip(cartoes, "ELAB", de)).texto, null);
  });
  test("deve listar quem passou quando o limite é por pessoa", () => {
    const e = estadoWip(elab({ limite_wip: 1, limite_por_pessoa: true }), contarWip(cartoes, "ELAB", de));
    assert.equal(e.texto, "máx. 1/pessoa");
    assert.deepEqual(e.acima, ["ana@x.com"]);
    assert.equal(e.excedido, true);
  });
});

describe("avisoAoMover", () => {
  test("deve avisar quando o total passaria do limite", () => {
    const n = contarWip(cartoes, "ELAB", de);
    assert.match(avisoAoMover(elab({ limite_wip: 3 }), n, []) ?? "", /4 cartões; o limite é 3/);
  });
  test("não deve avisar quando ainda cabe", () => {
    assert.equal(avisoAoMover(elab({ limite_wip: 4 }), contarWip(cartoes, "ELAB", de), []), null);
  });
  test("não deve avisar quando o cartão já está na coluna", () => {
    assert.equal(avisoAoMover(elab(), contarWip(cartoes, "ELAB", de), [], true), null);
  });
  test("deve avisar só pela pessoa que passaria do limite quando é por pessoa", () => {
    const n = contarWip(cartoes, "ELAB", de);
    const aviso = avisoAoMover(elab({ limite_wip: 2, limite_por_pessoa: true }), n, ["ANA@x.com", "bia@x.com"]);
    assert.match(aviso ?? "", /ana@x\.com passa do limite de 2 por pessoa/);
  });
  test("não deve avisar por pessoa quando o cartão não tem responsável", () => {
    assert.equal(avisoAoMover(elab({ limite_wip: 1, limite_por_pessoa: true }), contarWip(cartoes, "ELAB", de), []), null);
  });
});
