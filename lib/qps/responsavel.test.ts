import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { acharMembro, filtrarTime, normalizarNome, podeUsarNomeManual } from "./responsavel";

const TIME = [
  { nome: "Ana Paula Souza", cargo: "Psicóloga", funcao: "Psicossocial" },
  { nome: "Ana Paula Lima", cargo: "Psicóloga", funcao: "Psicossocial" },
  { nome: "Sanmyo Michael Mendes de Paiva", cargo: "Psicólogo", funcao: "Psicossocial" },
  { nome: "José Henrique", cargo: "Médico do Trabalho", funcao: "Engenheiro" },
  { nome: "Carlos Mendes", cargo: "TI", funcao: "Suporte" },
];

describe("acharMembro — pré-seleção do valor gravado", () => {
  test("CAIXA ALTA casa com o cadastro (é 7 dos 10 valores em produção)", () => {
    assert.equal(
      acharMembro(TIME, "SANMYO MICHAEL MENDES DE PAIVA")?.nome,
      "Sanmyo Michael Mendes de Paiva",
    );
  });

  test("acento não impede o casamento", () => {
    assert.equal(acharMembro(TIME, "jose henrique")?.nome, "José Henrique");
  });

  test("nome PARCIAL não casa — adivinhar escolheria a pessoa errada", () => {
    // "Ana Paula" bate com dois cadastros; o componente mostra o valor como
    // legado em vez de resolver sozinho.
    assert.equal(acharMembro(TIME, "Ana Paula"), null);
  });

  test("vazio e espaço não casam com ninguém", () => {
    assert.equal(acharMembro(TIME, ""), null);
    assert.equal(acharMembro(TIME, "   "), null);
  });
});

describe("filtrarTime", () => {
  test("busca vazia devolve o time inteiro", () => {
    assert.equal(filtrarTime(TIME, "").length, TIME.length);
  });

  test("casa por função, não só por nome — é a origem do defeito do Enter", () => {
    assert.equal(filtrarTime(TIME, "Psicossocial").length, 3);
  });

  test("casa por cargo", () => {
    assert.equal(filtrarTime(TIME, "Psicólog").length, 3);
  });

  test("nome de fora do time não casa com ninguém", () => {
    assert.equal(filtrarTime(TIME, "Maria Externa").length, 0);
  });
});

describe("podeUsarNomeManual", () => {
  const chamar = (busca: string, salvo = "") =>
    podeUsarNomeManual({ busca, filtrados: filtrarTime(TIME, busca), time: TIME, salvo });

  test("nome de fora do time é oferecido", () => {
    assert.equal(chamar("Maria Externa"), true);
  });

  test("NÃO oferece enquanto a lista tem alguém — senão o Enter de quem só filtrava grava", () => {
    // Os dois estragos que o portão mediu na versão sem esta guarda:
    assert.equal(chamar("Psicossocial"), false, 'digitar a função gravava "Psicossocial" como pessoa');
    assert.equal(chamar("Ana Paula"), false, "nome parcial ambíguo entre dois cadastros");
    assert.equal(chamar("Suporte"), false, "casava por função e gravava o texto da busca");
  });

  test("texto curto demais é tecla errada, não nome", () => {
    assert.equal(chamar(""), false);
    assert.equal(chamar("   "), false);
    assert.equal(chamar("a"), false);
  });

  test("quem já é do time por nome exato não vira opção manual", () => {
    assert.equal(chamar("Carlos Mendes"), false);
    assert.equal(chamar("CARLOS MENDES"), false);
  });

  test("não oferece o que já está gravado", () => {
    assert.equal(chamar("Maria Externa", "maria externa"), false);
    assert.equal(chamar("Maria Externa", "Outra Pessoa"), true);
  });

  test("é mutuamente exclusivo com a mensagem de lista vazia", () => {
    // A tela mostra "Ninguém no time com esse nome" só quando NÃO oferece o
    // manual. Se as duas condições pudessem valer juntas, a lista exibiria a
    // mensagem ao lado do botão de usar o nome.
    for (const busca of ["Maria Externa", "Psicossocial", "Ana Paula", "zzz", "a", ""]) {
      const filtrados = filtrarTime(TIME, busca);
      const manual = podeUsarNomeManual({ busca, filtrados, time: TIME, salvo: "" });
      const mostraVazio = filtrados.length === 0 && !manual;
      assert.equal(manual && mostraVazio, false, `conflito em "${busca}"`);
    }
  });
});

describe("normalizarNome", () => {
  test("tira acento, caixa e espaço das pontas, mas preserva espaço interno", () => {
    assert.equal(normalizarNome("  José  Henrique  "), "jose  henrique");
    assert.equal(normalizarNome("ÁÉÍÓÚ"), "aeiou");
  });
});
