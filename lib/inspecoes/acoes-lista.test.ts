import { test } from "node:test";
import assert from "node:assert/strict";
import { acoesDaLista, soConsultaDocumento } from "./acoes-lista";

test("só consulta: quem tem a marca e não é supervisor", () => {
  assert.equal(soConsultaDocumento({ ve_relatorio_lista: true }, false), true);
  assert.equal(soConsultaDocumento({ ve_relatorio_lista: true }, true), false);
  assert.equal(soConsultaDocumento({ ve_relatorio_lista: false }, false), false);
  assert.equal(soConsultaDocumento({}, false), false);
  assert.equal(soConsultaDocumento(null, false), false);
});

test("supervisor vê a coluna e o Editar, com ou sem a marca", () => {
  assert.deepEqual(acoesDaLista({ perfil: "Visualizador" }, true), { coluna: true, editar: true });
  assert.deepEqual(acoesDaLista({ perfil: "Admin", ve_relatorio_lista: true }, true), { coluna: true, editar: true });
});

test("com a marca: só o relatório, sem Editar", () => {
  assert.deepEqual(acoesDaLista({ perfil: "Visualizador", ve_relatorio_lista: true }, false), { coluna: true, editar: false });
  assert.deepEqual(acoesDaLista({ perfil: "Tecnico", ve_relatorio_lista: true }, false), { coluna: true, editar: false });
});

test("Técnico sem a marca: só o relatório (10/11), e não vira só consulta", () => {
  for (const marca of [false, null, undefined]) {
    assert.deepEqual(acoesDaLista({ perfil: "Tecnico", ve_relatorio_lista: marca }, false), { coluna: true, editar: false });
    assert.equal(soConsultaDocumento({ ve_relatorio_lista: marca }, false), false);
  }
});

test("Visualizador sem a marca: sem coluna", () => {
  for (const marca of [false, null, undefined]) {
    assert.deepEqual(acoesDaLista({ perfil: "Visualizador", ve_relatorio_lista: marca }, false), { coluna: false, editar: false });
  }
});

test("Cliente não vê mesmo com a marca, e sem usuário não há coluna", () => {
  assert.deepEqual(acoesDaLista({ perfil: "Cliente", ve_relatorio_lista: true }, false), { coluna: false, editar: false });
  assert.deepEqual(acoesDaLista(null, false), { coluna: false, editar: false });
});
