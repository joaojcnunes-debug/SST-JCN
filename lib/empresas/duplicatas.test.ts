import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectarDuplicatas } from "./duplicatas";

/** Casos REAIS da produção em 2026-09-21 (nomes públicos de empresas). */
const BASE = [
  { id_empresa: "E1", nome_empresa: "A. C. F. DA SILVA LTDA", cnpj: "10.555.527/0001-36", id_unidade: "CAMPOS" },
  { id_empresa: "E2", nome_empresa: "HOSPITAL EM CASA PRODUTOS MEDICOS LTDA", cnpj: "13267504000203", id_unidade: "NF" },
  { id_empresa: "E3", nome_empresa: "HOSPITAL EM CASA PRODUTOS MÉDICOS LTDA", cnpj: "13267504000629", id_unidade: "NF" },
  { id_empresa: "E4", nome_empresa: "CERAMICA T MARIANO", cnpj: null, cpf: "123.456.789-01", id_unidade: "CAMPOS" },
  { id_empresa: "E5", nome_empresa: "CERAMICA R C R LTDA", cnpj: "22222222000191", id_unidade: "CAMPOS" },
];
const ids = (xs: { id_empresa: string }[]) => xs.map((x) => x.id_empresa);

describe("detectarDuplicatas", () => {
  it("mesmo CNPJ, com ou sem máscara, é a MESMA empresa (o caso das 29 cópias)", () => {
    const d = detectarDuplicatas(BASE, { nome: "A C F da Silva", cnpj: "10555527000136" });
    assert.deepEqual(ids(d.mesmoCodigo), ["E1"]);
    assert.deepEqual(d.mesmoNome, []);
  });
  it("mesmo CPF também conta como mesmo código", () => {
    const d = detectarDuplicatas(BASE, { nome: "Outro nome qualquer", cpf: "12345678901" });
    assert.deepEqual(ids(d.mesmoCodigo), ["E4"]);
  });
  it("mesmo nome com acento diferente e CNPJ diferente = mesmoNome (pode ser filial), não bloqueia", () => {
    const d = detectarDuplicatas(BASE, { nome: "Hospital em Casa Produtos Médicos Ltda", cnpj: "13267504001100" });
    assert.deepEqual(d.mesmoCodigo, []);
    assert.deepEqual(ids(d.mesmoNome).sort(), ["E2", "E3"]);
  });
  it("nome contido = parecida (só para olhar)", () => {
    const d = detectarDuplicatas(BASE, { nome: "Ceramica T Mariano Ltda" });
    assert.deepEqual(d.mesmoCodigo, []);
    assert.deepEqual(d.mesmoNome, []);
    assert.deepEqual(ids(d.parecidas), ["E4"]);
  });
  it("CNPJ incompleto não acusa nada; nome curto não opina", () => {
    const d = detectarDuplicatas(BASE, { nome: "LTDA", cnpj: "10.555" });
    assert.deepEqual(d, { mesmoCodigo: [], mesmoNome: [], parecidas: [] });
  });
  it("em edição, a própria empresa não é duplicata de si mesma", () => {
    const d = detectarDuplicatas(BASE, { nome: "A. C. F. DA SILVA LTDA", cnpj: "10555527000136", ignorarId: "E1" });
    assert.deepEqual(d.mesmoCodigo, []);
    assert.deepEqual(d.mesmoNome, []);
  });
  it("o mesmo registro não aparece em duas listas", () => {
    const d = detectarDuplicatas(BASE, { nome: "A. C. F. DA SILVA LTDA", cnpj: "10555527000136" });
    assert.deepEqual(ids(d.mesmoCodigo), ["E1"]);
    assert.deepEqual(d.mesmoNome, []);
    assert.deepEqual(d.parecidas, []);
  });
});
