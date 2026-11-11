import { test } from "node:test";
import assert from "node:assert/strict";
import { SENHA_MIN, erroSenha, traduzirErroSenha } from "./senha";

test("o mínimo é 8 (o mesmo configurado no servidor de login)", () => {
  assert.equal(SENHA_MIN, 8);
});

test("deve aceitar a senha quando ela tem 8 caracteres ou mais", () => {
  assert.equal(erroSenha("12345678"), null);
  assert.equal(erroSenha("uma senha bem comprida"), null);
});

test("deve recusar com a mensagem em português quando a senha tem menos de 8 caracteres", () => {
  assert.equal(erroSenha("1234567"), "A senha deve ter pelo menos 8 caracteres");
  assert.equal(erroSenha("123456", true), "A nova senha deve ter pelo menos 8 caracteres");
});

test("deve recusar quando a senha está vazia", () => {
  assert.equal(erroSenha(""), "A senha deve ter pelo menos 8 caracteres");
});

test("deve traduzir a recusa do GoTrue quando ela chega em inglês", () => {
  assert.equal(traduzirErroSenha("Password should be at least 12 characters."), "A senha deve ter pelo menos 12 caracteres");
});

test("deve manter a mensagem quando o erro não é de tamanho de senha", () => {
  assert.equal(traduzirErroSenha("User not found"), "User not found");
});
