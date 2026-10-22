import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { TABELAS_VISAO_GERAL, moduloDaTabela, tabelaPermitida } from "./tabelas";

// O que estes testes protegem: a Visão geral do Início não pode voltar a ler
// tabela de módulo que a conta não tem (vazamento medido no log da trava em
// 23–28/09). E toda tabela que ela soma precisa ter módulo no mapa FONTES —
// tabela nova sem módulo ficaria de fora em silêncio.

describe("Visão geral — tabelas por módulo", () => {
  test("as 8 tabelas têm módulo no mapa (FONTES)", () => {
    for (const t of TABELAS_VISAO_GERAL) assert.ok(moduloDaTabela(t), `sem módulo: ${t}`);
  });
  test("módulos esperados (os mesmos da trava no banco)", () => {
    assert.equal(moduloDaTabela("drps_relatorios"), "psicossocial");
    assert.equal(moduloDaTabela("inspecoes"), "painel");
    assert.equal(moduloDaTabela("apreciacoes_maquinas"), "apreciacao_maquinas");
  });
  test("conta de 2 módulos lê só as 2 tabelas deles", () => {
    const lidas = TABELAS_VISAO_GERAL.filter((t) => tabelaPermitida(t, ["painel", "aet"]));
    assert.deepEqual(lidas, ["inspecoes", "aet_relatorios"]);
  });
  test("sem módulos, nada é lido", () => {
    assert.deepEqual(TABELAS_VISAO_GERAL.filter((t) => tabelaPermitida(t, [])), []);
  });
});
