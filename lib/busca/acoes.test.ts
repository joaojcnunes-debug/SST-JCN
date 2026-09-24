import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buscarAcoes } from "./acoes";

describe("buscarAcoes — tela, contador e PDF com o MESMO critério", () => {
  const acoes = [
    { what_acao: "Instalar proteção na serra", who_responsavel: "João", where_local: "Produção" },
    { what_acao: "Trocar extintor vencido", who_responsavel: "Maria", where_local: "Almoxarifado" },
    { what_acao: "Sinalizar área de máquinas", who_responsavel: null, where_local: null },
  ];
  it("acento e erro de digitação não escondem ação", () => {
    assert.equal(buscarAcoes(acoes, "protecao").itens.length, 1);
    assert.equal(buscarAcoes(acoes, "producao").itens.length, 1);
    assert.equal(buscarAcoes(acoes, "extintro").itens.length, 1);
    assert.equal(buscarAcoes(acoes, "joao").itens[0].what_acao, "Instalar proteção na serra");
  });
  it("registro cru do banco (unknown) funciona igual ao tipado", () => {
    const cru: Record<string, unknown>[] = acoes.map((a) => ({ ...a, extra: 1 }));
    assert.equal(buscarAcoes(cru, "máquinas").itens.length, 1);
    assert.equal(buscarAcoes(cru, "").itens.length, 3);
  });
  it("mantém a ordem de prazo em que veio do banco (não ranqueia)", () => {
    // "Extintor da cozinha" COMEÇA pela busca e subiria num seletor; numa
    // tabela por prazo ele fica onde o banco o pôs, depois de "Trocar extintor".
    const comQuarta = [...acoes, { what_acao: "Extintor da cozinha — recarga", who_responsavel: null, where_local: null }];
    const r = buscarAcoes(comQuarta, "extintor");
    assert.deepEqual(r.itens.map((x) => x.what_acao), ["Trocar extintor vencido", "Extintor da cozinha — recarga"]);
  });
});
