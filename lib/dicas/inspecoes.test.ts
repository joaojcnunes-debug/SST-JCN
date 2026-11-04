import { test } from "node:test";
import assert from "node:assert/strict";
import { DICA_MAX_CARACTERES } from "./empresas";
import { DICAS_RISCO } from "./riscos";
import { DICAS_NOVA_INSPECAO } from "./inspecoes";
import * as EDITOR from "./inspecao-editor";
import * as EPI from "./epi";
import * as AET from "./aet";
import * as AEP from "./aep";
import * as DRPS from "./drps";
import * as QPS from "./qps";
import * as APR from "./apreciacao";
import * as GESTAO from "./gestao";
import * as CONFIG from "./config";

for (const [nome, dicas] of [
  ["Risco", DICAS_RISCO],
  ["Nova inspeção", DICAS_NOVA_INSPECAO],
  ...Object.entries(EDITOR),
  ...Object.entries(EPI),
  ...Object.entries(AET),
  ...Object.entries(AEP),
  ...Object.entries(DRPS),
  ...Object.entries(QPS),
  ...Object.entries(APR),
  ...Object.entries(GESTAO),
  ...Object.entries(CONFIG),
] as const) {
  test(`dicas de ${nome}: todas preenchidas, curtas e terminando em ponto`, () => {
    for (const [campo, texto] of Object.entries(dicas)) {
      assert.ok(texto.trim().length > 10, `${campo}: texto curto demais`);
      assert.ok(texto.length <= DICA_MAX_CARACTERES, `${campo}: ${texto.length} caracteres (máx. ${DICA_MAX_CARACTERES})`);
      assert.match(texto, /[.!?]$/, `${campo}: termine a frase com ponto`);
    }
  });
}
