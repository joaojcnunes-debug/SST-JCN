import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  mesmoConjunto,
  planoAcessoQuadros,
  quadrosDeSetor,
  quadrosIndividuais,
  quadrosViaEquipe,
  unidadesIniciais,
  type QuadroAcesso,
} from "./acesso-unidade-setor";

const TERE = "UNI-TERE";
const PETRO = "UNI-PETRO";
const QUADROS: QuadroAcesso[] = [
  { id_quadro: "Q-TERE", nome: "Teresópolis", id_unidade: TERE, dono_email: null },
  { id_quadro: "Q-PETRO", nome: "Petrópolis", id_unidade: PETRO, dono_email: null },
  { id_quadro: "Q-REC", nome: "Recepção", id_unidade: null, dono_email: null },
  { id_quadro: "Q-ENF", nome: "Enfermagem", id_unidade: null, dono_email: null },
  { id_quadro: "Q-MEU", nome: "Meu Quadro — Ana", id_unidade: null, dono_email: "ana@x.com" },
];

describe("acesso por unidade e setor (tela de usuários)", () => {
  test("setores = quadros sem unidade e não pessoais, por nome", () => {
    assert.deepEqual(quadrosDeSetor(QUADROS).map((q) => q.id_quadro), ["Q-ENF", "Q-REC"]);
  });

  test("grants individuais e de equipe são separados", () => {
    const grants = [
      { id_quadro: "Q-REC", usuario_email: "Ana@X.com", id_equipe: null },
      { id_quadro: "Q-TERE", usuario_email: null, id_equipe: "EQ1" },
    ];
    assert.deepEqual([...quadrosIndividuais(grants, "ana@x.com")], ["Q-REC"]);
    assert.deepEqual([...quadrosViaEquipe(grants, new Set(["EQ1"]))], ["Q-TERE"]);
    assert.deepEqual([...quadrosViaEquipe(grants, new Set())], []);
  });

  test("unidades iniciais: as gravadas; senão, as dos quadros de unidade que já acessa", () => {
    assert.deepEqual([...unidadesIniciais([PETRO], QUADROS, new Set(["Q-TERE"]))], [PETRO]);
    assert.deepEqual([...unidadesIniciais(null, QUADROS, new Set(["Q-TERE", "Q-REC"]))], [TERE]);
    assert.deepEqual([...unidadesIniciais([], QUADROS, new Set())], []);
  });

  test("marcar unidade + setor concede total no quadro da unidade e no do setor", () => {
    const r = planoAcessoQuadros({
      quadros: QUADROS, individuais: new Set(), viaEquipe: new Set(),
      unidadesSel: new Set([TERE]), setoresSel: new Set(["Q-REC"]),
    });
    assert.deepEqual(r, { conceder: ["Q-TERE", "Q-REC"], revogar: [] });
  });

  test("desmarcar revoga só o grant individual; o que já tem fica igual", () => {
    const r = planoAcessoQuadros({
      quadros: QUADROS, individuais: new Set(["Q-PETRO", "Q-REC"]), viaEquipe: new Set(),
      unidadesSel: new Set([TERE]), setoresSel: new Set(["Q-REC"]),
    });
    assert.deepEqual(r, { conceder: ["Q-TERE"], revogar: ["Q-PETRO"] });
  });

  test("quadro que já vem pela equipe não ganha grant individual", () => {
    const r = planoAcessoQuadros({
      quadros: QUADROS, individuais: new Set(), viaEquipe: new Set(["Q-TERE"]),
      unidadesSel: new Set([TERE]), setoresSel: new Set(),
    });
    assert.deepEqual(r, { conceder: [], revogar: [] });
  });

  test("Meu Quadro nunca entra no plano", () => {
    const r = planoAcessoQuadros({
      quadros: QUADROS, individuais: new Set(["Q-MEU"]), viaEquipe: new Set(),
      unidadesSel: new Set(), setoresSel: new Set(),
    });
    assert.deepEqual(r, { conceder: [], revogar: [] });
  });

  test("mesmoConjunto", () => {
    assert.equal(mesmoConjunto(new Set(["a", "b"]), new Set(["b", "a"])), true);
    assert.equal(mesmoConjunto(new Set(["a"]), new Set(["a", "b"])), false);
  });
});
