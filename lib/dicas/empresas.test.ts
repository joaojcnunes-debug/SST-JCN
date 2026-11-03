import { test } from "node:test";
import assert from "node:assert/strict";
import { DICAS_EMPRESA, DICA_MAX_CARACTERES } from "./empresas";

test("dicas de Empresas: todas preenchidas, curtas e terminando em ponto", () => {
  for (const [campo, texto] of Object.entries(DICAS_EMPRESA)) {
    assert.ok(texto.trim().length > 10, `${campo}: texto curto demais`);
    assert.ok(texto.length <= DICA_MAX_CARACTERES, `${campo}: ${texto.length} caracteres (máx. ${DICA_MAX_CARACTERES})`);
    assert.match(texto, /[.!?]$/, `${campo}: termine a frase com ponto`);
  }
});
