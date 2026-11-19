import { test } from "node:test";
import assert from "node:assert/strict";
import { digitosCnpj, grafiasCnpj, laudosParaOferecer, vinculoAtual, type LaudoDaEmpresa } from "./laudos-empresa";

const laudo = (p: Partial<LaudoDaEmpresa>): LaudoDaEmpresa => ({
  id_relatorio: "R",
  id_empresa: "EMP-1",
  id_inspecao: null,
  status: "CONCLUIDO",
  data_elaboracao: null,
  responsavel_elaboracao: null,
  created_at: null,
  ...p,
});

test("grafiasCnpj: dígitos e máscara; vazio sem CNPJ", () => {
  assert.equal(digitosCnpj("31.427.455/0001-11"), "31427455000111");
  assert.deepEqual(grafiasCnpj("31427455000111"), ["31427455000111", "31.427.455/0001-11"]);
  assert.deepEqual(grafiasCnpj("31.427.455/0001-11"), ["31427455000111", "31.427.455/0001-11"]);
  assert.deepEqual(grafiasCnpj(null), []);
  assert.deepEqual(grafiasCnpj("123"), ["123"]);
});

test("vinculoAtual: sem inspeção, outra inspeção ou outro cadastro", () => {
  assert.equal(vinculoAtual(laudo({}), "EMP-1"), "sem_inspecao");
  assert.equal(vinculoAtual(laudo({ id_inspecao: "INS-A" }), "EMP-1"), "outra_inspecao");
  assert.equal(vinculoAtual(laudo({ id_empresa: "EMP-2", id_inspecao: "INS-B" }), "EMP-1"), "outro_cadastro");
});

test("laudosParaOferecer: tira o desta inspeção e ordena do mais novo", () => {
  const r = laudosParaOferecer(
    [
      laudo({ id_relatorio: "velho", data_elaboracao: "2026-01-10" }),
      laudo({ id_relatorio: "desta", id_inspecao: "INS-X", data_elaboracao: "2026-11-01" }),
      laudo({ id_relatorio: "novo", data_elaboracao: "2026-10-05" }),
      laudo({ id_relatorio: "sem-data", created_at: "2026-06-01T10:00:00Z" }),
    ],
    "INS-X",
  );
  assert.deepEqual(r.map((l) => l.id_relatorio), ["novo", "sem-data", "velho"]);
});
