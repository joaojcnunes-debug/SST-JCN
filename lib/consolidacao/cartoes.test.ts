import { test } from "node:test";
import assert from "node:assert/strict";
import { avisosDoCartao, resumirDocs, resumirRegistro, type DocsDaEmpresa } from "./cartoes";

test("registro: sem registro, aguardando, validando (parte das empresas) e validada (todas)", () => {
  const ex = [{ id_execucao: "X1", criado_em: "2026-10-01" }, { id_execucao: "X2", criado_em: "2026-11-01" }];
  assert.equal(resumirRegistro([], [], 2).situacao, "sem-registro");
  assert.deepEqual(resumirRegistro(ex, [{ id_execucao: "X1", id_empresa: "A" }], 2), { situacao: "aguardando", ultimoEm: "2026-11-01", validadas: 0 });
  assert.equal(resumirRegistro(ex, [{ id_execucao: "X2", id_empresa: "A" }], 2).situacao, "validando");
  assert.equal(resumirRegistro(ex, [{ id_execucao: "X2", id_empresa: "A" }, { id_execucao: "X2", id_empresa: "B" }], 2).situacao, "validada");
});

test("documentos e avisos: sem documento, sem AEP, sem questionário, antigo e fora do acesso", () => {
  const membros = [
    { id: "A", nome: "Alfa", visivel: true },
    { id: "B", nome: "Beta", visivel: true },
    { id: "C", nome: "Gama", visivel: true },
    { id: "D", nome: "Delta", visivel: true },
    { id: "E", nome: "Épsilon", visivel: false },
  ];
  const docs = new Map<string, DocsDaEmpresa>([
    ["A", { AEP: { data: "2026-10-01" }, DRPS: { data: "2023-05-01" } }],
    ["B", { QPS: { data: "2026-09-01" } }],
    ["C", { AEP: { data: "2026-08-01" } }],
  ]);
  assert.deepEqual(resumirDocs(membros, docs), { comAep: 2, comQuestionario: 2, maisRecente: "2026-10-01" });
  const av = avisosDoCartao(membros, docs, "2026-11-27");
  assert.deepEqual(av.map((a) => [a.tipo, a.texto]), [
    ["sem-documento", "1 empresa sem AEP nem DRPS/QPS"],
    ["sem-aep", "1 empresa sem AEP"],
    ["sem-questionario", "1 empresa sem DRPS/QPS"],
    ["documento-antigo", "Documento com mais de 2 anos em 1 empresa"],
    ["fora-do-acesso", "1 empresa fora do seu acesso"],
  ]);
  assert.deepEqual(av[0].empresas, ["Delta"]);
});
