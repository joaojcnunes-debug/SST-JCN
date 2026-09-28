import { test } from "node:test";
import assert from "node:assert/strict";

import { permissoesDim } from "./permissoes";

test("Admin faz tudo", () => {
  const p = permissoesDim({ perfil: "Admin", funcao: "TI" });
  assert.deepEqual(p, { acesso: true, verHeadcount: true, verHistorico: true, editar: true, sincronizar: true });
});

test("Gerente vê tudo e não edita nada", () => {
  const p = permissoesDim({ perfil: "Tecnico", funcao: "Gerente" });
  assert.equal(p.acesso, true);
  assert.equal(p.verHeadcount, true);
  assert.equal(p.verHistorico, true);
  assert.equal(p.editar, false);
  assert.equal(p.sincronizar, false);
});

test("Supervisores editam os cadastros e não veem o Headcount", () => {
  for (const funcao of ["Supervisor dos técnicos", "Supervisora do administrativo"]) {
    const p = permissoesDim({ perfil: "Tecnico", funcao });
    assert.equal(p.acesso, true, funcao);
    assert.equal(p.editar, true, funcao);
    assert.equal(p.verHeadcount, false, funcao);
    assert.equal(p.verHistorico, false, funcao);
    assert.equal(p.sincronizar, false, funcao);
  }
});

test("outras funções, inativos e sem usuário não entram", () => {
  assert.equal(permissoesDim({ perfil: "Tecnico", funcao: "Técnico de campo" }).acesso, false);
  assert.equal(permissoesDim({ perfil: "Tecnico", funcao: "Gerente", ativo_sistema: false }).acesso, false);
  assert.equal(permissoesDim({ perfil: "Admin", ativo_sistema: false }).acesso, false);
  assert.equal(permissoesDim(null).acesso, false);
});
