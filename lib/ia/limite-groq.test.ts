import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { CODIGO_LIMITE_IA, erroLimiteIaDaFuncao, limiteIa, mensagemLimiteIa, segundosParaTentar } from "./limite-groq";
import { mensagemErro } from "../errors";

// O que estes testes protegem: o 429 do Groq vira uma frase que diz QUANTO
// esperar. Os formatos abaixo são os que o Groq escreve em "Please try again
// in …" — segundos com fração, milissegundos e minuto+segundos.

const MSG_GROQ = (espera: string) =>
  JSON.stringify({
    error: {
      message: `Rate limit reached for model \`qwen/qwen3.8-27b\` in organization \`org_x\` on tokens per minute (TPM): Limit 8000, Used 7420, Requested 1870. Please try again in ${espera}. Visit https://console.groq.com/docs/rate-limits for more information.`,
      type: "tokens",
      code: "rate_limit_exceeded",
    },
  });

describe("segundosParaTentar", () => {
  test("segundos com fração arredondam para cima", () => {
    assert.equal(segundosParaTentar(null, MSG_GROQ("7.5s")), 8);
  });
  test("milissegundos viram pelo menos 1 segundo", () => {
    assert.equal(segundosParaTentar(null, MSG_GROQ("450ms")), 1);
  });
  test("minuto e segundos somam", () => {
    assert.equal(segundosParaTentar(null, MSG_GROQ("1m2.5s")), 63);
  });
  test("só minutos", () => {
    assert.equal(segundosParaTentar(null, MSG_GROQ("2m")), 120);
  });
  test("o cabeçalho retry-after vence a mensagem", () => {
    assert.equal(segundosParaTentar("12", MSG_GROQ("7.5s")), 12);
  });
  test("cabeçalho inválido cai para a mensagem", () => {
    assert.equal(segundosParaTentar("abc", MSG_GROQ("3s")), 3);
  });
  test("sem pista nenhuma, espera padrão de 10 s", () => {
    assert.equal(segundosParaTentar(null, "{}"), 10);
  });
});

describe("mensagemLimiteIa", () => {
  test("plural e singular", () => {
    assert.equal(mensagemLimiteIa(8), "Limite de uso da IA atingido. Tente de novo em 8 segundos.");
    assert.equal(mensagemLimiteIa(1), "Limite de uso da IA atingido. Tente de novo em 1 segundo.");
  });
});

describe("limiteIa", () => {
  test("429 vira o corpo com código e espera", async () => {
    const res = new Response(MSG_GROQ("7.5s"), { status: 429 });
    const corpo = await limiteIa(res, "teste");
    assert.deepEqual(corpo, {
      error: "Limite de uso da IA atingido. Tente de novo em 8 segundos.",
      codigo: CODIGO_LIMITE_IA,
      tentar_em: 8,
    });
  });
  test("a tela mostra a frase: mensagemErro reconhece o código (formato do functions.invoke)", () => {
    const msg = mensagemLimiteIa(8);
    const erro = Object.assign(new Error(msg), { code: CODIGO_LIMITE_IA });
    assert.equal(mensagemErro(erro, "Erro ao gerar com IA"), msg);
  });
  test("sem o código, a mesma frase cai no genérico — é o código que libera", () => {
    assert.equal(mensagemErro(new Error(mensagemLimiteIa(8)), "Erro ao gerar com IA"), "Erro ao gerar com IA");
  });
  test("qualquer outro status devolve null e não consome o corpo", async () => {
    const res = new Response("erro interno", { status: 500 });
    assert.equal(await limiteIa(res, "teste"), null);
    assert.equal(await res.text(), "erro interno");
  });
});

describe("erroLimiteIaDaFuncao (edge functions do JCN)", () => {
  test("502 com um modelo em 429 vira a frase com a espera", () => {
    const corpo = JSON.stringify({ error: `Groq falhou em todos os modelos — qwen/qwen3-32b: 429 ${MSG_GROQ("12.3s")}` });
    const e = erroLimiteIaDaFuncao(502, corpo);
    assert.equal(e?.code, CODIGO_LIMITE_IA);
    assert.equal(mensagemErro(e, "x"), "Limite de uso da IA atingido. Tente de novo em 13 segundos.");
  });
  test("corpo já no formato do painel (codigo limite_ia)", () => {
    const e = erroLimiteIaDaFuncao(429, JSON.stringify({ error: "Limite de uso da IA atingido. Tente de novo em 5 segundos.", codigo: "limite_ia", tentar_em: 5 }));
    assert.equal(e?.message, "Limite de uso da IA atingido. Tente de novo em 5 segundos.");
  });
  test("outros erros (404 do modelo, 500) seguem null", () => {
    assert.equal(erroLimiteIaDaFuncao(502, JSON.stringify({ error: "Groq falhou em todos os modelos — x: 404 model not found" })), null);
    assert.equal(erroLimiteIaDaFuncao(500, "GROQ_API_KEY não configurada"), null);
  });
});
