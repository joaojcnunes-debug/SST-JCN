import { test } from "node:test";
import assert from "node:assert/strict";
import { ROTAS_CONFIG_AET, ROTAS_CONFIG_QPS, rotaNaLista } from "./rotas-protegidas";

test("rotaNaLista pega a rota e o que fica abaixo dela", () => {
  assert.equal(rotaNaLista("/aet/texto-padrao", ROTAS_CONFIG_AET), true);
  assert.equal(rotaNaLista("/aet/texto-padrao/capitulo", ROTAS_CONFIG_AET), true);
  assert.equal(rotaNaLista("/questionarios-psicossociais/tipos", ROTAS_CONFIG_QPS), true);
});

test("rotaNaLista não pega laudo nem rota parecida", () => {
  assert.equal(rotaNaLista("/aet", ROTAS_CONFIG_AET), false);
  assert.equal(rotaNaLista("/aet/abc123/dados", ROTAS_CONFIG_AET), false);
  assert.equal(rotaNaLista("/aet/texto-padrao-x", ROTAS_CONFIG_AET), false);
  assert.equal(rotaNaLista("/questionarios-psicossociais/abc/resultados", ROTAS_CONFIG_QPS), false);
});
