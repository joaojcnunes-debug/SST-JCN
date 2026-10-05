import { test } from "node:test";
import assert from "node:assert/strict";

import { linhasCsv, montarComercial, numeroNr, situacaoComRevisao, situacaoPorDocs, type InspecaoComercial } from "./oportunidades";

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

function insp(idEmpresa: string, p: Partial<InspecaoComercial> = {}): InspecaoComercial {
  return {
    id_inspecao: "INS-" + idEmpresa,
    id_empresa: idEmpresa,
    concluida_em: "2026-10-03",
    responsavel: "Caio",
    empresas: empresa("Empresa " + idEmpresa),
    maquinas: [],
    medicoes: [],
    quimicos: [],
    ergonomicos: 0,
    psicossociais: 0,
    treinamentos: [],
    ...p,
  };
}

const produtos = (r: ReturnType<typeof montarComercial>[number]) => r.oportunidades.map((o) => [o.produto, o.situacao]);

test("situação pelos documentos e número da NR", () => {
  assert.equal(situacaoPorDocs([]), "aberta");
  assert.equal(situacaoPorDocs(["RASCUNHO"]), "andamento");
  assert.equal(situacaoPorDocs(["RASCUNHO", "CONCLUIDO"]), "realizada");
  assert.equal(situacaoPorDocs(["FINALIZADO"]), "realizada");
  assert.equal(situacaoPorDocs(["DELETADO"]), "aberta");
  assert.equal(numeroNr("NR-06"), "6");
  assert.equal(numeroNr("NR 35"), "35");
});

test("AEP: AET e DRPS/Questionário, com a situação pelo que a empresa já tem", () => {
  const [c] = montarComercial([aep("A1", "E1", [setorAet])], [{ id_empresa: "E1", tipo: "QPS", status: "RASCUNHO" }]);
  assert.deepEqual(produtos(c), [["AET", "aberta"], ["DRPS/Questionário", "andamento"]]);
  assert.deepEqual(c.oportunidades[0].setores, [{ nome: "Produção", expostos: 12, cargos: 1 }]);
  assert.equal(c.expostosAet, 12);
  assert.equal(c.telefone, "21 9999");
  assert.equal(c.temAep, true);
});

test("AEP: AET só pela ergonomia física entra; sem indicação não entra", () => {
  const r = montarComercial(
    [aep("A1", "E1", [setorSoFisico]), aep("A2", "E2", [{ id: "x", nome_setor: "ADM", necessita_aet: false, checklist_organizacional: {} }])],
    [],
  );
  assert.deepEqual(r.map((c) => c.empresa.idEmpresa), ["E1"]);
  assert.equal(r[0].expostosAet, 5);
});

test("Inspeção: NR-12, medição, químicos, AEP, psicossocial e treinamentos", () => {
  const [c] = montarComercial(
    [],
    [
      { id_empresa: "E1", tipo: "APRECIACAO", status: "RASCUNHO" },
      { id_empresa: "E1", tipo: "QUIMICOS", status: "CONCLUIDO" },
    ],
    [
      insp("E1", {
        maquinas: [{ nome: "Serra", grau_risco: "ALTO", adequacao: true }],
        medicoes: [{ agente: "Ruído", qual: "Dosimetria", setor: "Produção" }],
        quimicos: ["Tolueno"],
        ergonomicos: 2,
        psicossociais: 1,
        treinamentos: [{ nr: "NR-06", titulo: "EPI" }, { nr: "NR-35", titulo: "Altura" }],
      }),
    ],
    [{ id_empresa: "E1", nr: "NR 6" }],
  );
  assert.deepEqual(produtos(c), [
    ["AEP", "aberta"],
    ["DRPS/Questionário", "aberta"],
    ["Apreciação NR-12", "andamento"],
    ["Medição quantitativa", "aberta"],
    ["Análise de Químicos", "realizada"],
    ["Treinamentos NR", "andamento"],
  ]);
  assert.deepEqual(c.oportunidades[2].detalhes, ["Serra (grau alto) · necessita adequação"]);
  assert.deepEqual(c.oportunidades[3].detalhes, ["Dosimetria · Produção"]);
  assert.match(c.oportunidades[5].detalhes[0], /certificado emitido/);
  assert.equal(c.inspecao?.idInspecao, "INS-E1");
  assert.equal(c.temAep, false);
});

test("DRPS/Questionário pela AEP e pela inspeção vira uma oportunidade só, com as duas origens", () => {
  const [c] = montarComercial([aep("A1", "E1", [setorAet])], [], [insp("E1", { psicossociais: 2 })]);
  const drps = c.oportunidades.filter((o) => o.produto === "DRPS/Questionário");
  assert.equal(drps.length, 1);
  assert.deepEqual(drps[0].origens, ["AEP", "Inspeção"]);
  assert.equal(drps[0].detalhes.length, 2);
});

test("treinamentos todos com certificado = realizada; empresa sem nada indicado não entra", () => {
  const r = montarComercial([], [], [
    insp("E1", { treinamentos: [{ nr: "NR-01", titulo: "GRO" }] }),
    insp("E2"),
  ], [{ id_empresa: "E1", nr: "NR-01" }]);
  assert.deepEqual(r.map((c) => [c.empresa.idEmpresa, c.oportunidades[0].situacao]), [["E1", "realizada"]]);
});

test("abertas primeiro; CSV com uma linha por oportunidade", () => {
  const r = montarComercial(
    [aep("A1", "E1", [setorSoFisico]), aep("A2", "E2", [setorSoFisico])],
    [{ id_empresa: "E1", tipo: "AET", status: "CONCLUIDO" }],
  );
  assert.deepEqual(r.map((c) => c.empresa.idEmpresa), ["E2", "E1"]);
  const csv = linhasCsv(r, () => "Serra");
  assert.equal(csv.length, 3);
  assert.equal(csv[1][2], "Serra");
  assert.equal(csv[1][6], "AET – Análise Ergonômica do Trabalho");
  assert.equal(csv[1][8], "AEP");
  assert.equal(csv[1][10], "5");
});

test("DRPS concluído antes da AEP vira revisão recomendada; depois, realizada", () => {
  assert.equal(situacaoComRevisao([{ id_empresa: "E", tipo: "DRPS", status: "CONCLUIDO", data: "2026-06-30" }], "2026-10-05"), "revisao");
  assert.equal(situacaoComRevisao([{ id_empresa: "E", tipo: "DRPS", status: "CONCLUIDO", data: "2026-10-05T10:00:00Z" }], "2026-10-05"), "realizada");
  assert.equal(situacaoComRevisao([{ id_empresa: "E", tipo: "DRPS", status: "CONCLUIDO" }], "2026-10-05"), "realizada");
  const [c] = montarComercial(
    [aep("A1", "E1", [setorAet])],
    [{ id_empresa: "E1", tipo: "DRPS", status: "CONCLUIDO", data: "2026-06-30" }],
  );
  const drps = c.oportunidades.find((o) => o.produto === "DRPS/Questionário");
  assert.equal(drps?.situacao, "revisao");
  assert.match(drps?.detalhes.join(" ") ?? "", /DRPS concluído em 30\/06\/2026, antes da indicação de 05\/10\/2026/);
});
