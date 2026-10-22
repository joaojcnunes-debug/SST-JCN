import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { quemPerdeAcesso, type UsuarioAcesso } from "./perda-de-acesso";

const NF = "UNI-NF";
const TERE = "UNI-TERE";

const usuarios: UsuarioAcesso[] = [
  { nome: "Alexandre", email: "Alexandre@x.com", perfil: "Tecnico", ativo_sistema: true, unidades: [NF] },
  { nome: "Bia", email: "bia@x.com", perfil: "Tecnico", ativo_sistema: true, unidades: [NF, TERE] },
  { nome: "Admin", email: "adm@x.com", perfil: "Admin", ativo_sistema: true, unidades: [] },
  { nome: "Inativo", email: "ina@x.com", perfil: "Tecnico", ativo_sistema: false, unidades: [NF] },
];

describe("quemPerdeAcesso", () => {
  it("caso DUNA 02/10: técnico só de NF perde acesso ao ir para Teresópolis", () => {
    const r = quemPerdeAcesso(["alexandre@x.com"], usuarios, TERE);
    assert.deepEqual(r, [{ nome: "Alexandre", email: "alexandre@x.com", inspecoes: 1 }]);
  });

  it("quem tem a unidade nova, Admin e inativo não entram", () => {
    const r = quemPerdeAcesso(["bia@x.com", "adm@x.com", "ina@x.com"], usuarios, TERE);
    assert.deepEqual(r, []);
  });

  it("conta as inspeções por pessoa e ignora quem não fez inspeção", () => {
    const r = quemPerdeAcesso(["ALEXANDRE@x.com", "alexandre@x.com", null], usuarios, TERE);
    assert.equal(r.length, 1);
    assert.equal(r[0].inspecoes, 2);
  });

  it("e-mail que não está no cadastro de usuários não quebra", () => {
    assert.deepEqual(quemPerdeAcesso(["fantasma@x.com"], usuarios, TERE), []);
  });
});
