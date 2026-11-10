import { test } from "node:test";
import assert from "node:assert/strict";
import { tituloNaAgenda } from "./agenda";

test("com empresa: a empresa vem antes do título", () => {
  assert.equal(tituloNaAgenda({ titulo: "Visita técnica" }, "Creche Lar Feliz"), "Creche Lar Feliz · Visita técnica");
  assert.equal(tituloNaAgenda({ titulo: "Medição", id_tarefa_pai: "T1", titulo_mae: "PGR" }, "Papucaia"), "Papucaia · Medição");
});

test("título que já traz a empresa (sem acento, sem maiúsculas) não repete", () => {
  assert.equal(tituloNaAgenda({ titulo: "CRECHE LAR FELIZ - visita" }, "Creche Lar Feliz"), "CRECHE LAR FELIZ - visita");
  assert.equal(tituloNaAgenda({ titulo: "Visita Teresopolis" }, "Teresópolis"), "Visita Teresopolis");
});

test("sem empresa: subtarefa leva a tarefa-mãe; tarefa fica só com o título", () => {
  assert.equal(tituloNaAgenda({ titulo: "Visita técnica", id_tarefa_pai: "T1", titulo_mae: "Escola X - PGR" }, null), "Visita técnica · Escola X - PGR");
  assert.equal(tituloNaAgenda({ titulo: "Treinamento NR-35", id_tarefa_pai: null }, null), "Treinamento NR-35");
  assert.equal(tituloNaAgenda({ titulo: "Visita", id_tarefa_pai: "T1", titulo_mae: "" }, ""), "Visita");
});
