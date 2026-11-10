import { test } from "node:test";
import assert from "node:assert/strict";
import { comVolta, enderecoDaLista, rotuloVolta, voltaSegura } from "./volta";

test("voltaSegura: só caminho interno", () => {
  assert.equal(voltaSegura("/inspecoes/minhas?pessoa=USR-1"), "/inspecoes/minhas?pessoa=USR-1");
  assert.equal(voltaSegura(null), null);
  assert.equal(voltaSegura(""), null);
  assert.equal(voltaSegura("https://fora.com"), null);
  assert.equal(voltaSegura("//fora.com"), null);
  assert.equal(voltaSegura("/\\fora.com"), null);
});

test("comVolta: leva a lista com os filtros, e a ida e volta devolve o mesmo endereço", () => {
  const lista = "/inspecoes/minhas?pessoa=USR-1&status=PENDENTE,EM_ANDAMENTO&q=a b";
  const href = comVolta("/inspecoes/INS-1/relatorio", lista);
  assert.ok(href.startsWith("/inspecoes/INS-1/relatorio?volta="));
  assert.equal(new URL(href, "http://x").searchParams.get("volta"), lista);
  assert.equal(comVolta("/inspecoes/INS-1?aba=x", "/inspecoes").includes("?aba=x&volta="), true);
});

test("comVolta: sem lista válida o endereço fica como está", () => {
  assert.equal(comVolta("/inspecoes/INS-1", null), "/inspecoes/INS-1");
  assert.equal(comVolta("/inspecoes/INS-1", "https://fora.com"), "/inspecoes/INS-1");
});

test("enderecoDaLista: sem filtro não deixa ? sobrando", () => {
  assert.equal(enderecoDaLista("/inspecoes/minhas", ""), "/inspecoes/minhas");
  assert.equal(enderecoDaLista("/inspecoes/minhas", "pessoa=1"), "/inspecoes/minhas?pessoa=1");
});

test("rotuloVolta: diz para onde vai", () => {
  assert.equal(rotuloVolta("/inspecoes/minhas?pessoa=1"), "Voltar para Minhas inspeções");
  assert.equal(rotuloVolta("/inspecoes?tecnico=Ana"), "Voltar para Inspeções");
  assert.equal(rotuloVolta("/outra"), "Voltar à lista");
});
