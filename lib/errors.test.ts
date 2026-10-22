import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mensagemErro } from "./errors";

/**
 * `mensagemErro` devolve o FALLBACK para erro desconhecido, de propósito, para
 * nunca vazar SQL cru ao usuário. A consequência é que uma frase só chega à
 * tela se o erro carregar um código reconhecido — por isso estes testes: se
 * alguém apagar um desses ramos, a mensagem some em silêncio e o usuário volta
 * a ver um genérico que não diz o que fazer.
 */
describe("mensagemErro", () => {
  test("nao_gravou: a frase do 0-linhas chega inteira ao usuário", () => {
    // Escrita barrada por RLS volta 2xx com lista vazia; quem escreve levanta
    // este código (lib/qps/gravacao.ts). Apagar o ramo faz cair no fallback.
    const msg = "A alteração não foi gravada: o banco não autorizou a edição.";
    assert.equal(mensagemErro({ code: "nao_gravou", message: msg }, "fallback"), msg);
  });

  test("P0001: a mensagem dos nossos RPCs também passa inteira", () => {
    assert.equal(mensagemErro({ code: "P0001", message: "Já existe laudo no período." }, "fb"), "Já existe laudo no período.");
  });

  test("erro desconhecido NÃO vaza a mensagem crua — cai no fallback", () => {
    assert.equal(
      mensagemErro({ message: 'relation "qps_aplicacoes" does not exist' }, "Não foi possível salvar."),
      "Não foi possível salvar.",
    );
  });

  test("código conhecido do Postgres tem prioridade sobre a mensagem", () => {
    assert.equal(mensagemErro({ code: "42501", message: "permission denied" }, "fb"), "Você não tem permissão para esta ação.");
  });

  test("sem erro, devolve o fallback", () => {
    assert.equal(mensagemErro(null, "fb"), "fb");
    assert.equal(mensagemErro(undefined, "fb"), "fb");
  });
});
