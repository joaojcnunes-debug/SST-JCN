import { test } from "node:test";
import assert from "node:assert/strict";
import { situacaoDasEmpresas } from "./empresasSituacao";

const hoje = "2026-11-03";

test("situação da empresa = pior documento; agrupado por cidade, pior primeiro", () => {
  const grupos = situacaoDasEmpresas(
    [
      { id_empresa: "A", nome_empresa: "Alfa", municipio: "Rio de Janeiro", uf: "RJ" },
      { id_empresa: "B", nome_empresa: "Beta", municipio: "Rio de Janeiro", uf: "RJ" },
      { id_empresa: "C", nome_empresa: "Gama", municipio: "Niterói", uf: "RJ" },
      { id_empresa: "D", nome_empresa: "Delta", municipio: null, uf: null },
    ],
    [
      { idEmpresa: "A", data_validade: "2027-06-01" }, // em dia
      { idEmpresa: "B", data_validade: "2026-11-20" }, // vence em 17 dias
      { idEmpresa: "B", data_validade: "2027-06-01" },
      { idEmpresa: "C", data_validade: "2026-10-01" }, // vencido
      { idEmpresa: "C", data_validade: null }, // sem validade não conta
      { idEmpresa: null, data_validade: "2020-01-01" }, // sem empresa não conta
    ],
    hoje,
  );
  assert.deepEqual(grupos.map((g) => g.cidade), ["Niterói/RJ", "Rio de Janeiro/RJ", "Sem cidade informada"]);
  assert.deepEqual(grupos[0].empresas.map((e) => [e.nome, e.situacao, e.vencidos]), [["Gama", "vencido", 1]]);
  assert.deepEqual(grupos[1].empresas.map((e) => [e.nome, e.situacao]), [["Beta", "atencao"], ["Alfa", "em_dia"]]);
  assert.deepEqual(grupos[2].empresas.map((e) => e.situacao), ["sem_doc"]);
});
