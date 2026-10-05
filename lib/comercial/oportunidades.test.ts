import { test } from "node:test";
import assert from "node:assert/strict";

import { linhasCsv, montarComercial, situacaoPorDocs } from "./oportunidades";

const empresa = (nome: string) => ({ nome_empresa: nome, cnpj: null, municipio: "Teresópolis", uf: "RJ", id_unidade: "U1", telefone: "21 9999", email: "a@b.c" });

const setorAet = {
  id: "s1",
  nome_setor: "Produção",
  qtd_expostos: 12,
  necessita_aet: true,
  cargos: [{ cargo: "Operador" }, { cargo: "" }],
  checklist_organizacional: { assedio: "sim", sobrecarga: "sim", baixo_controle: "sim" },
  sinais_organizacional: {},
  aiha_organizacional: { assedio: { probabilidade: "x", severidade: "y", nivel: "Alto" } },
};
const setorSoFisico = { id: "s2", nome_setor: "Expedição", qtd_expostos: 5, necessita_aet: true, cargos: [], checklist_organizacional: {} };

function aep(id: string, idEmpresa: string, setores: unknown[], extra: Record<string, unknown> = {}) {
  return {
    id_relatorio: id,
    id_empresa: idEmpresa,
    status: "CONCLUIDO",
    setores,
    responsavel_elaboracao: "Ana",
    data_elaboracao: "2026-10-01",
    entregue_em: "2026-10-05",
    enviado_por: null,
    empresas: empresa("Empresa " + idEmpresa),
    ...extra,
  } as never;
}

test("situação pelos documentos", () => {
  assert.equal(situacaoPorDocs([]), "aberta");
  assert.equal(situacaoPorDocs(["RASCUNHO"]), "andamento");
  assert.equal(situacaoPorDocs(["RASCUNHO", "CONCLUIDO"]), "realizada");
  assert.equal(situacaoPorDocs(["DELETADO"]), "aberta");
});

test("AET e DRPS/Questionário viram oportunidades, com a situação pelo que a empresa já tem", () => {
  const r = montarComercial([aep("A1", "E1", [setorAet])], [{ id_empresa: "E1", tipo: "QPS", status: "RASCUNHO" }]);
  assert.equal(r.length, 1);
  const [c] = r;
  assert.deepEqual(
    c.oportunidades.map((o) => [o.produto, o.situacao]),
    [["AET", "aberta"], ["DRPS/Questionário", "andamento"]],
  );
  assert.deepEqual(c.oportunidades[0].setores, [{ nome: "Produção", expostos: 12, cargos: 1 }]);
  assert.equal(c.expostosAet, 12);
  assert.equal(c.telefone, "21 9999");
});

test("AET indicada só pela ergonomia física também entra; sem indicação nenhuma não entra", () => {
  const r = montarComercial(
    [aep("A1", "E1", [setorSoFisico]), aep("A2", "E2", [{ id: "x", nome_setor: "ADM", necessita_aet: false, checklist_organizacional: {} }])],
    [],
  );
  assert.deepEqual(r.map((c) => c.empresa.idEmpresa), ["E1"]);
  assert.equal(r[0].oportunidades[0].produto, "AET");
  assert.equal(r[0].expostosAet, 5);
});

test("AET já concluída fica como realizada; abertas vêm primeiro", () => {
  const r = montarComercial(
    [aep("A1", "E1", [setorSoFisico]), aep("A2", "E2", [setorSoFisico])],
    [{ id_empresa: "E1", tipo: "AET", status: "CONCLUIDO" }],
  );
  assert.deepEqual(r.map((c) => [c.empresa.idEmpresa, c.oportunidades[0].situacao]), [["E2", "aberta"], ["E1", "realizada"]]);
});

test("CSV: cabeçalho + uma linha por oportunidade", () => {
  const r = montarComercial([aep("A1", "E1", [setorAet])], []);
  const csv = linhasCsv(r, () => "Serra");
  assert.equal(csv.length, 3);
  assert.equal(csv[1][2], "Serra");
  assert.equal(csv[1][6], "AET");
  assert.equal(csv[1][9], "12");
});
